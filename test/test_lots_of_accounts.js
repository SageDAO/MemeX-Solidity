const { ethers } = require("hardhat");
const { Wallet } = require('ethers');
prov = ethers.getDefaultProvider();

describe(' Generate lots of accounts', () => {
    

    let mnemonic = "radar blur cabbage chef fix engine embark joy scheme fiction master release";


    it("print wallet address", async () => {
        let j;
        let k = 0;
        
        for (let i = 1; i< 100; i++){
            j = i % 10
            if (j == 0){
                k = k+1
            }
            console.log(k,j)
            const wallet = Wallet.fromMnemonic(mnemonic, `m/44'/60'/${k.toString()}'/${j.toString()}`);
            console.log(await wallet.getBalance())
            
        }
    })
})