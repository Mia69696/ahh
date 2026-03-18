require('dotenv').config();

// Start both the bot and the web dashboard together
require('./bot');
require('./server');
