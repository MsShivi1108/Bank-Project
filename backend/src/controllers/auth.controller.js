const userModel = require("../models/user.model.js")
const jwt = require("jsonwebtoken")
// const bcrypt = require('bcryptjs')

/**
 * 
 * - user reg cntrlr
 * - POST /api/auth/reg 
 */

async function userReg(req, res) {
    const { email, password, name } = req.body

    const isExists = await userModel.findOne({
        email: email
    }).select(password)

    if (isExists) {
        return res.status(422).json({
            message: "User already exists with this email.",
            status: "failed"
        })
    }

    try {
        const user = await userModel.create({
            name, email, password
        })

        //install jsonwebtoken

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

        //install cookieparser

        res.cookie("token", token)

        return res.status(201).json({
            user: {
                name,
                email,
                _id:user._id
            },
            token
        })

    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "internal server error {err in auth.controller file inside userReg fun", error: error.message })
    }
}


const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validate inputs
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        let existUser = await userModel.findOne({ email }).select("+password")   // +passsword will tell while fetching the user data to also include password as it is false by default in model schema

        if (!existUser) {
            return res.status(401).json("Invalid email or password")
        }

        let match = await existUser.isPasswordCorrect(String(password))
        // let match = await bcrypt.compare(password, existUser.password)
        if (!match) {
            return res.status(401).json("Invalid email or password")
        }

        // let token;
        // try {
        //     token = generateToken(existUser._id);
        // } catch (error) {
        //     console.log(error)
        // }

        // res.cookie("token", token)
        // return res.status(200).json({
        //     user: {
        //         fullName: existUser.fullName,
        //         email: existUser.email,
        //         username: existUser.username,

        //     }
        // })

        const token = jwt.sign({ userId: existUser._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

        //install cookieparser

        res.cookie("token", token)

        res.status(200).json({
            user: {
                name: existUser.name,
                email:existUser.email,
                _id:existUser._id
            },
            token
        })

    } catch (error) {
        console.log(error);
        res.status(400).json({ error })
    }
}

module.exports = { userReg, login }
