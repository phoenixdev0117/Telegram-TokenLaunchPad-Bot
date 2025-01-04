import {   recognizeExistance, sleep } from "./src/utils"
import { balances_display, gather_display, main_menu_display, prepare_bundle_display, rl, screen_clear, security_checks_display, token_holders_display, token_launch_display, token_sell_buy_display } from "./menu/menu";
import { create_token } from "./layout/createToken";
import { create_market } from "./layout/createMarket";
import { bundle_pool_buy } from "./layout/poolBuy";
import { burn_lp } from "./src/burnLp";
import { manual_part_sell } from "./layout/manualPartSell";
import { wallet_create } from "./layout/walletCreate";
import { create_atas } from "./layout/createAta";
import { simulate } from "./layout/simulation";
import { sol_gather } from "./layout/solGather";
import { create_extend_lut } from "./layout/createLut";
import { remove_liquidity } from "./layout/removeLiquidity";
import { manual_rebuy } from "./layout/manualRebuy";
import { holder_distribute } from "./layout/holderDistribute";
import { holder_create } from "./layout/holderCreate";
import { holder_gather_all } from "./layout/holderGatherAll";
import { holder_gather_some } from "./layout/holderGatherSome";
import { show_bundlers } from "./layout/showBundlerBalance";
import { sol_distribute } from "./layout/solDistribute";
import { presimulate } from "./layout/preSimulate";
import { revokeMintAuthority } from "./src/revokeMintAuthority";
import { revokeFreezeAuthority } from "./src/revokeFreezeAuthority";
import { show_holders } from "./layout/showHolderBalance";
import { manual_each_sell } from "./layout/manualEachSell";
import { each_sol_gather } from "./layout/eachSolGather";
import TelegramBot, { Message, ParseMode, SendMessageOptions }  from "node-telegram-bot-api";
import { token_information } from "./layout/token_information";
// import { sol_distribute } from "./layout/solDistribute";


const Token = process.env.TELEGRAM_TOKEN;
console.log("Bot token:", Token); // Confirm token is loaded
let chatId: TelegramBot.ChatId | undefined = 0;

export const bot = new TelegramBot(Token as string, { polling: true });



export const BotSendMessage = (message : string) =>{

  bot.sendMessage(chatId ?? 0, message);
}

export const BotSendDocument = (filePath : string, filename : string) =>{
  
  bot.sendDocument(chatId ?? 0, filePath, {
    caption: 'Here is Log PDF file'
  }, {
    filename: filename,
    contentType: 'application/pdf'
  });
}
// Function to send error messages
export function sendErrorMessage(message : string) {
  const formattedMessage = `*Error:* ${message}`;
  bot.sendMessage(chatId ?? 0, formattedMessage, { parse_mode: 'MarkdownV2' });
}

// Function to send warning messages
export function sendWarningMessage(message : string) {
  const formattedMessage = `*Warning:* ${message}`;
  bot.sendMessage(chatId ?? 0, formattedMessage, { parse_mode: 'MarkdownV2' });
}

// Function to send success messages
export function sendSuccessMessage(message : string) {
  const formattedMessage = `*Success:* ${message}`;
  bot.sendMessage(chatId ?? 0, formattedMessage, { parse_mode: 'MarkdownV2' });
}

export const BotMessageOptions = (message : string, options: TelegramBot.SendMessageOptions) => {

  bot.sendMessage(chatId ?? 0, message, options);
}


export const optionMenu: SendMessageOptions= {
  reply_markup: {
      inline_keyboard: [
          [{ text: "💎 Token Launch", callback_data: "Token_Launch" }, { text: "💸 Token Holders", callback_data: "Token_Holders" }],
          [{ text: "💱 Token Sell & Buy", callback_data: "Token_Sell_Buy" }],
          // [{ text: "[2] - Token Holders", callback_data: "Token_Holders" }],
          [ { text: "💰 Gather Sol from bundler wallets", callback_data: "Gather_Sol_bundler_wallet" }],
          // [{ text: "[4] - Gather Sol from bundler wallets", callback_data: "Gather_Sol_bundler_wallet" }],
          [{ text: "🏆 Balance of bundlers and holders", callback_data: "Balance_bundlers_holders" }],
          [{ text: "📣 Token Information", callback_data: "Token_Information" }],
          [{ text: "❌ Exit", callback_data: "Exit" }],
      ],
  },
};
export const optionPreMenu: SendMessageOptions = {
  reply_markup: {
      inline_keyboard: [
          [{ text: "💎 Token Launch", callback_data: "Token_Launch" }, { text: "💸 Token Holders", callback_data: "Token_Holders" }],
          [{ text: "💱 Token Sell & Buy", callback_data: "Token_Sell_Buy" }],
          // [{ text: "[2] - Token Holders", callback_data: "Token_Holders" }],
          [ { text: "💰 Gather Sol from bundler wallets", callback_data: "Gather_Sol_bundler_wallet" }],
          // [{ text: "[4] - Gather Sol from bundler wallets", callback_data: "Gather_Sol_bundler_wallet" }],
          [{ text: "🏆 Balance of bundlers and holders", callback_data: "Balance_bundlers_holders" }],
          [{ text: "❌ Exit", callback_data: "Exit" }],
      ],
  },
};
export const optionTokenLaunch: SendMessageOptions = {
  reply_markup: {
      inline_keyboard: [
          // [{ text: "✍Pre simulate", callback_data: "Pre_simulate" }, { text: "👷‍♂️Create Token", callback_data: "Create_Token" }],
          [{ text: "👷‍♂️Create Token", callback_data: "Create_Token" }],
          [{ text: "🔐 Security checks", callback_data: "Security_Checks" }],
          [{ text: "Create Market", callback_data: "Create_Market" }],
          [{ text: "Prepare for Bundle", callback_data: "Prepare_Bundle" }],
          // [{ text: "💰 Create holder wallets", callback_data: "Create_holder_wallets" },{ text: "Create Pool And BundleBuy", callback_data: "Create_Pool_bundleBuy" },{ text: "Burn LP token", callback_data: "Burn_LP" }],
          [{ text: "💰 Create holder wallets", callback_data: "Create_holder_wallets" }],
          [{ text: "Create Pool And BundleBuy", callback_data: "Create_Pool_bundleBuy" }],
          [{ text: "Burn LP token", callback_data: "Burn_LP" }],
          [{ text: "👈 Back", callback_data: "Back" }, { text: "❌ Exit", callback_data: "Exit" }],
        ],
  },

};
export const optionSecurityChecks: SendMessageOptions = {
  reply_markup: {
      inline_keyboard: [
          [{ text: "Remove Mint Authority", callback_data: "revokeMintAuthority" }],
          [{ text: "Freeze Authority", callback_data: "revokeFreezeAuthority" }],
          [{ text: "👈 Back", callback_data: "BackToTokenLaunch" }, { text: "❌ Exit", callback_data: "Exit" }],
      ],
  },
};
export const optionPrepareBundle: SendMessageOptions = {
  reply_markup: {
      inline_keyboard: [
        [{ text: "Wallet Create", callback_data: "wallet_create" }],
        [{ text: "Create AssociatedTokenAccounts", callback_data: "create_atas" }],
        [{ text: "Create LUT", callback_data: "create_extend_lut" }],
        [{ text: "Extend and Simulate tx size", callback_data: "simulate" }],
        [{ text: "👈 Back", callback_data: "BackToTokenLaunch" }, { text: "❌ Exit", callback_data: "Exit" }],
      ],
  },
};
export const optionTokenHolders: SendMessageOptions = {
  reply_markup: {
      inline_keyboard: [
          [{ text: "Distribute Token to HolderWallets", callback_data: "Distribute_HolderWallets" }],
          [{ text: "Gather selected Token to BundlerWallets", callback_data: "Gather_selected" }],
          [{ text: "Gather all Token to BundlerWallets", callback_data: "Gather_all" }],
          [{ text: "👈 Back", callback_data: "Back" }, { text: "❌ Exit", callback_data: "Exit" }],

      ],
  },
};
export const optionSellBuy: SendMessageOptions = {
  reply_markup: {
      inline_keyboard: [
          [{ text: "Sell tokens partially", callback_data: "Sell_partially" }],
          [{ text: "Sell tokens from each Bundler", callback_data: "Sell_each_Bundler" }],
          [{ text: "Rebuy tokens partially", callback_data: "Rebuy_partially" }],
          [{ text: "Remove liquidity", callback_data: "Remove_liquidity" }],
          [{ text: "👈 Back", callback_data: "Back" }, { text: "❌ Exit", callback_data: "Exit" }],

      ],
  },
};
export const optionGather: SendMessageOptions = {
  reply_markup: {
      inline_keyboard: [
          [{ text: "Gather Sol from all bundler wallets", callback_data: "Gather_from_all" }],
          [{ text: "Gather Wsol from one bundler wallet", callback_data: "Gather_from_one" }],
          [{ text: "Distribute sol to bundlers", callback_data: "Distribute_sol_to_bundlers" }],
          [{ text: "👈 Back", callback_data: "Back" }, { text: "❌ Exit", callback_data: "Exit" }],

      ],
  },
};
export const optionBalance: SendMessageOptions = {
  reply_markup: {
      inline_keyboard: [
          [{ text: "Show sol & token balances of bundlers", callback_data: "Show_bundlers" }],
          [{ text: "Show sol & token balances of holders", callback_data: "Show_holders" }],
          [{ text: "👈 Back", callback_data: "Back" }, { text: "❌ Exit", callback_data: "Exit" }],

      ],
  },
};
export const optionBack: SendMessageOptions = {
  disable_web_page_preview: true,
  reply_markup: {
      inline_keyboard: [
          [{ text: "👈 Back", callback_data: "Back" }, { text: "❌ Exit", callback_data: "Exit" }]
      ],
  },
};


bot.onText(/\/start/, (msg: Message) => {
  chatId = msg.chat.id;
  const userID = msg.from?.id;
  // USER_ID = chatId;
  console.log("--//---myChatID----//---", chatId);
  const passwordMessage = "Please enter password";
  // Send the welcome message with the inline keyboard
  // const welcomeMessage = "Hello! Welcome to the Token New Age Bot 🐉 🐸 🐲";
  // bot.sendMessage(chatId, welcomeMessage, optionMenu);
  bot.sendMessage(chatId, passwordMessage);
  bot.on("message", async (msg) => {
    var _a;
    const chatId = msg.chat.id;
    const USER_ID = chatId;
    const userID = msg.from?.id;
    const answer: string | undefined = msg.text ?? '';
  
    if (answer == 'Sam1415!'){
      init();
    } 
    else if(answer != '/start'){
      bot.sendMessage(chatId, 'Wrong Password! Please enter again.');
    }
  });
});

bot.on("callback_query", (callbackQuery) => {
  const message = callbackQuery.message;
  chatId = message?.chat.id;
  const category = callbackQuery.data; // The 'callback_data' associated with the button pressed.
  switch (category) {
    case 'Token_Launch':
        token_launch()
        break;
    case 'Token_Holders':
      token_holders()
      break;
    case 'Token_Sell_Buy':
      sell_buy()
      break;
    case 'Gather_Sol_bundler_wallet':
      gather();
      break;
    case 'Balance_bundlers_holders':
      balances();
      break;
    case 'Back':
      init();
      break;  
    case 'Exit':
      bot.sendMessage(chatId ?? 0, 'Bot is stopeed.');
      // process.exit(1);
      init();
      break;
    default:
      bot.sendMessage(chatId ?? 0, "\tInvalid choice!");
      // BotSendMessage("\tInvalid choice!");
      sleep(1500);
      init();
      break;
  }
});


export const init = () => {
  // screen_clear();
  // BotSendMessage("Raydium Token Launchpad");

  // main_menu_display();

  // rl.question("\t[Main] - Choice: ", (answer: string) => {
  //   let choice = parseInt(answer);
  //   switch (choice) {
  //     case 1:
  //       token_launch()
  //       break;
  //     case 2:
  //       token_holders()
  //       break;
  //     case 3:
  //       sell_buy()
  //       break;
  //     case 4:
  //       gather();
  //       break;
  //     case 5:
  //       balances();
  //       break;
  //     case 6:
  //       process.exit(1);
  //     default:
  //       BotSendMessage("\tInvalid choice!");
  //       sleep(1500);
  //       init();
  //       break;
  //   }
  // })
  if(recognizeExistance('TokenInfo.json'))  BotMessageOptions("\tHello! Welcome to the Token New Age Bot 🐉 🐸 🐲", optionMenu);
  else  BotMessageOptions("\tHello! Welcome to the Token New Age Bot 🐉 🐸 🐲", optionPreMenu);
}
// export const home = () => {
//   BotMessageOptions("\t[Main] - Choice: ", optionMenu );
  
// }

export const token_launch = () => {
  // screen_clear();
  // BotSendMessage("TOKEN LAUNCH")
  // token_launch_display()

  // rl.question("\t[Security Checks] - Choice: ", (answer: string) => {
  //   let choice = parseInt(answer);
  //   switch (choice) {
  //     case 1:
  //       presimulate();
  //       break;
  //     case 2:
  //       create_token();
  //       break;
  //     case 3:
  //       security_checks();
  //       break;
  //     case 4:
  //       create_market();
  //       break;
  //     case 5:
  //       prepare_bundle();
  //       break;
  //     case 6:
  //       holder_create()
  //       break;
  //     case 7:
  //       bundle_pool_buy();
  //       break;
  //     case 8:
  //       burn_lp();
  //       break;
  //     case 9:
  //       init();
  //       break;
  //     case 10:
  //       process.exit(1);
  //     default:
  //       BotSendMessage("\tInvalid choice!");
  //       sleep(1500);
  //       token_launch();
  //       break;
  //   }
  // })
  BotMessageOptions("\t[Token Launch] - Choice: ", optionTokenLaunch );
}

export const token_holders = () => {
  // screen_clear();
  // BotSendMessage("Token Holders")
  // token_holders_display();

  // rl.question("\t[Token Holders] - Choice: ", (answer: string) => {
  //   let choice = parseInt(answer);
  //   switch (choice) {
  //     case 1:
  //       holder_distribute()
  //       break;
  //     case 2:
  //       holder_gather_some()
  //       break;
  //     case 3:
  //       holder_gather_all()
  //       break;
  //     case 4:
  //       init();
  //       break;
  //     case 5:
  //       process.exit(1);
  //     default:
  //       BotSendMessage("\tInvalid choice!");
  //       sleep(1500);
  //       token_holders();
  //       break;
  //   }
  // })
  BotMessageOptions("\t[Token Holders] - Choice: ", optionTokenHolders );

}


// init()