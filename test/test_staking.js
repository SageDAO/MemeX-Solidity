
const { expect, assert } = require('chai');
const { artifacts } = require('hardhat');

describe('Staking Contract', () => {
    let StakingMeme, stakingMeme, owner, addr1, addr2, MemeToken, memeToken;

    beforeEach(async() => {
        StakingMeme = await ethers.getContractFactory('MemeXStaking');
        [owner, addr1, addr2, ...addr] = await ethers.getSigners();

        stakingMeme = await StakingMeme.deploy();

        MemeToken = await ethers.getContractFactory('MemeXToken');
        memeToken = token = await MemeToken.deploy("MEMEX", "MemeX", 1000000, owner.address);
    });

    describe('Staking contract features', () => {
        
    })
})