// Telegram Join Request Accept Bot
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

// Get bot token from environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('ERROR: Bot token is missing! Make sure TELEGRAM_BOT_TOKEN is set in .env file');
  process.exit(1);
}

// Create a bot instance with polling
const bot = new TelegramBot(token, { 
  polling: true,
  // Add polling options to reduce potential errors
  polling_interval: 300,
  timeout: 30
});

// Create users directory if it doesn't exist
const usersDir = path.join(__dirname, 'users');
fs.ensureDirSync(usersDir);

// Admin ID - you should replace this with your Telegram user ID
let adminId = null;

console.log('Telegram Join Request Accept Bot is starting...');
console.log('Bot will accept join requests after a 1-minute delay');

// Listen for chat join requests
bot.on('chat_join_request', (request) => {
  try {
    const chatId = request.chat.id;
    const userId = request.from.id;
    const userName = request.from.first_name || 'User';
    
    console.log(`Join request received from ${userName} (${userId}) for chat ${chatId}`);
    console.log(`Will accept in 1 minute...`);
    
    // Wait for 1 minute (60000 ms) before accepting the request
    setTimeout(() => {
      bot.approveChatJoinRequest(chatId, userId)
        .then(() => {
          console.log(`Approved join request for ${userName} (${userId}) in chat ${chatId}`);
          
          // Save user data to file immediately
          const userFile = path.join(usersDir, `${userId}.json`);
          const userInfo = {
            id: userId,
            name: userName,
            chatId: chatId,
            joinedAt: Date.now()
          };
          
          fs.writeJsonSync(userFile, userInfo);
          console.log(`User ${userName} (${userId}) saved to database`);
          
          // Send a welcome message to the user
          bot.sendMessage(userId, 
            `Hello ${userName}! Your request to join the channel has been accepted.`
          ).catch(error => {
            console.error(`Could not send welcome message to ${userName}:`, error.message);
          });
        })
        .catch((error) => {
          console.error(`Error approving join request for ${userName}:`, error.message);
          
          // Try again after 5 seconds if it fails
          setTimeout(() => {
            console.log(`Retrying approval for ${userName}...`);
            bot.approveChatJoinRequest(chatId, userId)
              .then(() => {
                console.log(`Successfully approved join request for ${userName} on second attempt`);
                
                // Save user data to file immediately
                const userFile = path.join(usersDir, `${userId}.json`);
                const userInfo = {
                  id: userId,
                  name: userName,
                  chatId: chatId,
                  joinedAt: Date.now()
                };
                
                fs.writeJsonSync(userFile, userInfo);
                console.log(`User ${userName} (${userId}) saved to database`);
                
                // Send a welcome message to the user
                bot.sendMessage(userId, 
                  `Hello ${userName}! Your request to join the channel has been accepted.`
                ).catch(error => {
                  console.error(`Could not send welcome message to ${userName}:`, error.message);
                });
              })
              .catch((retryError) => {
                console.error(`Failed to approve join request on retry:`, retryError.message);
              });
          }, 5000);
        });
    }, 60000); // 1 minute delay (60000 ms)
  } catch (error) {
    console.error('Error processing join request:', error.message);
  }
});

// Handle /start command
bot.onText(/\/start/, (msg) => {
  const userId = msg.from.id;
  const userName = msg.from.first_name || 'User';
  
  bot.sendMessage(userId, 
    `Hello ${userName}! I'm a channel join request bot. ` +
    `If you've requested to join a channel, I'll notify you when your request is accepted.`
  );
});

// Handle /setadmin command - hidden command, not shown in help
bot.onText(/\/setadmin/, (msg) => {
  adminId = msg.from.id;
  console.log(`Admin set to user ID: ${adminId}`);
  bot.sendMessage(msg.from.id, 'You are now set as the admin for this bot. You can use the broadcast feature.');
});

// Handle /broadcast command - only for admin
bot.onText(/\/broadcast (.+)/, (msg, match) => {
  const userId = msg.from.id;
  
  // Check if user is admin
  if (userId !== adminId) {
    bot.sendMessage(userId, 'Sorry, only the admin can use the broadcast feature.');
    return;
  }
  
  const broadcastMessage = match[1];
  
  // Get all user files
  fs.readdir(usersDir, (err, files) => {
    if (err) {
      console.error('Error reading users directory:', err);
      bot.sendMessage(userId, 'Error reading users database.');
      return;
    }
    
    const userFiles = files.filter(file => file.endsWith('.json'));
    const totalUsers = userFiles.length;
    
    if (totalUsers === 0) {
      bot.sendMessage(userId, 'No users found in the database.');
      return;
    }
    
    bot.sendMessage(userId, `Starting broadcast to ${totalUsers} users...`);
    
    // Send messages with rate limiting (20 messages per second max)
    let successCount = 0;
    let failCount = 0;
    let processedCount = 0;
    
    const sendBroadcastWithDelay = (index) => {
      if (index >= userFiles.length) {
        // All messages sent
        setTimeout(() => {
          bot.sendMessage(userId, 
            `Broadcast completed.\n` +
            `✅ Successfully sent: ${successCount}\n` +
            `❌ Failed: ${failCount}`
          );
        }, 1000);
        return;
      }
      
      // Read user file
      const userFile = path.join(usersDir, userFiles[index]);
      fs.readJson(userFile, (err, userData) => {
        if (err) {
          console.error(`Error reading user file ${userFiles[index]}:`, err);
          failCount++;
          processedCount++;
        } else {
          // Send message to user
          bot.sendMessage(userData.id, broadcastMessage)
            .then(() => {
              successCount++;
              processedCount++;
              console.log(`Broadcast sent to ${userData.name} (${userData.id})`);
            })
            .catch((error) => {
              failCount++;
              processedCount++;
              console.error(`Error sending broadcast to ${userData.id}:`, error.message);
            });
        }
        
        // Update progress every 10 users
        if (processedCount % 10 === 0 || processedCount === totalUsers) {
          bot.sendMessage(userId, 
            `Broadcast progress: ${processedCount}/${totalUsers}\n` +
            `✅ Success: ${successCount}\n` +
            `❌ Failed: ${failCount}`
          );
        }
        
        // Process next user with delay (to respect rate limits)
        setTimeout(() => {
          sendBroadcastWithDelay(index + 1);
        }, 50); // 50ms delay = max 20 messages per second
      });
    };
    
    // Start the broadcast process
    sendBroadcastWithDelay(0);
  });
});

// Handle /stats command - only for admin
bot.onText(/\/stats/, (msg) => {
  const userId = msg.from.id;
  
  // Check if user is admin
  if (userId !== adminId) {
    bot.sendMessage(userId, 'Sorry, only the admin can view stats.');
    return;
  }
  
  // Get all user files
  fs.readdir(usersDir, (err, files) => {
    if (err) {
      console.error('Error reading users directory:', err);
      bot.sendMessage(userId, 'Error reading users database.');
      return;
    }
    
    const userFiles = files.filter(file => file.endsWith('.json'));
    const totalUsers = userFiles.length;
    
    bot.sendMessage(userId, 
      `📊 Bot Statistics\n\n` +
      `Total users: ${totalUsers}`
    );
  });
});

// Handle /help command
bot.onText(/\/help/, (msg) => {
  const userId = msg.from.id;
  const isAdmin = userId === adminId;
  
  let helpMessage = 
    `📋 Available Commands:\n\n` +
    `/start - Start the bot\n` +
    `/help - Show this help message\n`;
  
  if (isAdmin) {
    helpMessage += 
      `\n👑 Admin Commands:\n` +
      `/broadcast [message] - Send message to all users\n` +
      `/stats - View bot statistics\n`;
  }
  
  bot.sendMessage(userId, helpMessage);
});

// Handle errors
bot.on('polling_error', (error) => {
  console.error('Polling error:', error.message);
  // Continue polling despite errors
});

// Log bot information on startup
bot.getMe()
  .then((botInfo) => {
    console.log(`Bot connected successfully: @${botInfo.username}`);
    console.log('Bot is now monitoring join requests...');
  })
  .catch((error) => {
    console.error('Error connecting to Telegram:', error.message);
    console.log('Please check your internet connection and bot token');
  });

// Handle application termination
process.on('SIGINT', () => {
  console.log('Bot is shutting down...');
  bot.stopPolling();
  process.exit(0);
});