// WIP 
// see https://hardhat.org/plugins/hardhat-deploy.html


module.exports = async ({
    getNamedAccounts,
    deployments,
    getChainId,
    getUnnamedAccounts,
}) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    // the following will only deploy  if the contract was never deployed or if the code changed since last deployment
    await deploy('MemeXToken', "MemeX", "MMX", 100000, deployer, {
        from: deployer,
        gasLimit: 4000000,
        args: [],
    });
};