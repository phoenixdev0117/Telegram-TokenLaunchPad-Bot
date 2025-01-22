import { BotMessageOptions, BotSendMessage, optionBack } from "..";
import fs from 'fs';

export const token_information = async () => {
    const filePath: string = `TokenInfo.json`
      try {
        // Check if the file exists
        if (fs.existsSync(filePath)) {
          // Read the file content
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    console.error('Error reading JSON file:', err);
                    return;
                }
            
                try {
                    // Parse the JSON data
                    const tokenInfo = JSON.parse(data);
            
                    // Extract variables from the parsed data
                    const name = tokenInfo.Name;
                    const symbol = tokenInfo.Symbol;
                    const supply = tokenInfo.Supply;
                    const decimals = tokenInfo.Decimals;
                    const description = tokenInfo.Description;
                    const website = tokenInfo.Social_links.website;
                    const twitter = tokenInfo.Social_links.twitter;
                    const telegram = tokenInfo.Social_links.telegram;
                    const linktree = tokenInfo.Social_links.LinkTree;
                    const tagsArray = tokenInfo.Tags;
                    const contractAddress = tokenInfo.Contract_Address;
                    const tags = tagsArray.join(', ');
                    // Log the extracted variables
                    const TokenInfoMessage = `
    -------------Token Information-----------

    *Token Name*: ${name}
    *Symbol*: ${symbol}
    *Supply*: ${supply}
    *Decimals*: ${decimals}
    *Description*: ${description}
    *Social Links*:
            Website*:${website}
            Twitter*:${twitter}
            Telegram*:${telegram}
            Linktree*:${linktree}
    *Tags*: ${tags}
    *Contract Address*: 
         ${contractAddress}
                    `
                    BotMessageOptions(TokenInfoMessage, optionBack);
                    
                } catch (parseError) {
                    console.error('Error parsing JSON:', parseError);
                }
            });
        } else {

            BotMessageOptions("TokenInformation is not exist", optionBack);

          return;
        }
      } catch (error) {
        console.log('Error reading data from JSON file:', error);
        return [];
      }
    
}
