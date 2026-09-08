const express = require("express")
const authController = require("../controllers/auth.controller.js")

const router = express.Router()

router.post("/register",authController.userReg)
router.post("/login",authController.login)

module.exports = router
