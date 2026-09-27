const accountModel = require("../models/account.model")

async function createAccountController(req, res) {

    const user = req.user;

    const account = await accountModel.create({
        user: user._id
    })

    res.status(201).json({
        account
    })

}

async function getUserAccountsController(req, res) {
    try {
        const user = req.user;
        const accounts = await accountModel.find({ user: user._id });
        res.status(200).json({
            accounts
        })
    } catch (error) {
        res.status(500).json({ message: "Error fetching accounts", error: error.message })
    }
}

// async function getAccountBalanceController(req, res) {
//     try {
//         const { accountId } = req.params;
//         const account = await accountModel.findById(accountId);
        
//         if (!account) {
//             return res.status(404).json({ message: "Account not found" })
//         }

//         res.status(200).json({
//             balance: account.balance
//         })
//     } catch (error) {
//         res.status(500).json({ message: "Error fetching balance", error: error.message })
//     }
// }

module.exports = { createAccountController,getUserAccountsController}
