import { LAMPORTS_PER_SOL } from "@solana/web3.js"
import { bundlerHoldingPercent, bundleWalletNum, distNum, holderTokenAmountMax, holderTokenAmountMin, quote_Mint_amount, tokens } from "../settings"
import { generateDistribution } from "../src/distribute"
import {   saveBundlerTokenAmountToFile, saveSwapSolAmountToFile, tokenLaunchWaiting } from "../src/utils"
import { BotSendMessage } from ".."

export const presimulate = () => {

    const initialTokenAmount = tokens[0].uiAmount
    const initialTokenHoldingAmount = initialTokenAmount * bundlerHoldingPercent
    const initialPrice = quote_Mint_amount / tokens[0].uiAmount
    BotSendMessage(`Total supply of the Token: ${initialTokenAmount}`)
    BotSendMessage(`Total amount of the Token to bundle: ${initialTokenHoldingAmount}`)
    BotSendMessage(`Dev pool creation: ${quote_Mint_amount}Sol`)
    BotSendMessage(`Initial token amount: ${initialTokenAmount} ${tokens[0].symbol}`)
    BotSendMessage(`First Price Token: ${initialPrice * LAMPORTS_PER_SOL} Lamports/${tokens[0].symbol}`)
    BotSendMessage(`Buying ${bundlerHoldingPercent}% from total amount from the pool`)

    let bundlerTokenPortionArray = generateDistribution(bundlerHoldingPercent * 10000, holderTokenAmountMin * distNum * 10000, holderTokenAmountMax * distNum * 10000, bundleWalletNum, "odd")
    let bundlerTokenPercentArray = bundlerTokenPortionArray.map((each: number) => Math.floor(each) / 10000)
    // saveHolderTokenAmountToFile(holderTokenBasisPercentArray)

    // let bundlerTokenBasisPercentArray = []
    // for(let i = 0; i < bundleWalletNum; i ++) {
    //     let each = 0
    //     for(let j = 0; j < distNum + 1; j++) {
    //         each += holderTokenBasisPercentArray[i * (distNum + 1) + j]
    //     }
    //     bundlerTokenBasisPercentArray.push(Number(each.toFixed(2)))
    // }

    saveBundlerTokenAmountToFile(bundlerTokenPercentArray)

    let solAmountArray: number[] = []
    let totalSol = 0
    const k = initialTokenAmount * quote_Mint_amount
    let currentToken = initialTokenAmount
    let currentSol = quote_Mint_amount
    for(let i = 0; i < bundleWalletNum; i++) {
        let changedToken = currentToken - initialTokenAmount * bundlerTokenPercentArray[i] / 100
        let changedSol = k / changedToken
        let bundlerSol = changedSol - currentSol
        solAmountArray.push(Math.floor(bundlerSol * LAMPORTS_PER_SOL) / LAMPORTS_PER_SOL)
        currentToken = changedToken
        currentSol = changedSol
        totalSol = totalSol + Math.floor(bundlerSol * LAMPORTS_PER_SOL) / LAMPORTS_PER_SOL
    }
    
    saveSwapSolAmountToFile(
        solAmountArray
    )

    for (let i = 0; i < bundleWalletNum; i ++) {
        const tokenAmount = Math.round(bundlerTokenPercentArray[i] / 100 * initialTokenAmount)
        BotSendMessage(`Bundler wallet ${i + 1}: buy ${solAmountArray[i]}sol, amount of Token ${tokenAmount} ${tokens[0].symbol}, ${(bundlerTokenPercentArray[i]).toFixed(4)}%`)
    }
    BotSendMessage(`Total Sol Balance ${totalSol}sol is required.`)

    tokenLaunchWaiting()
}