const express = require('express')
const User = require('../models/User')
const Order = require('../models/Orders')
const router = express.Router()
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs')
var jwt = require('jsonwebtoken');
const axios = require('axios')
const fetch = require('../middleware/fetchdetails');
const mongoose = require('mongoose');
const jwtSecret = "HaHa"
const stripe = require('stripe')("sk_test_51OXG5USFVTAtLYeuX1qjrPeTGYjZ0GBkXrOkefbH8cYm2pOK8nb8ILdtOvM36G8cbGYubleocT4g7HgzUauVPhsw00aTco3dE8")
// var foodItems= require('../index').foodData;
// require("../index")
//Creating a user and storing data to MongoDB Atlas, No Login Requiered
router.post('/createuser', [
    body('email','Please enter valid Email').isEmail(),
    body('password',"Password must be of length more than 5").isLength({ min: 5 }),
    body('name','Name should be of 3 letter').isLength({ min: 3 })
], async (req, res) => {
    let success = false
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success, errors: errors.array() })
    }
    try {
        let user = await User.findOne({email:req.body.email})
        if (user) {
            return res.status(400).json({ error: 'Email already exists' });
          }
    const salt = await bcrypt.genSalt(10)
    let securePass = await bcrypt.hash(req.body.password, salt);
        await User.create({
            name: req.body.name,
            // password: req.body.password,  first write this and then use bcryptjs
            password: securePass,
            email: req.body.email,
            location: req.body.location
        })
            const data = {
                user: {
                    id: user.id
                }
            }
            const authToken = jwt.sign(data, jwtSecret);
            success = true
            res.json({ success, authToken })
        }
            
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
})

// Authentication a User, No login Requiered
router.post('/login', [
    body('email', "Enter a Valid Email").isEmail(),
    body('password', "Password cannot be blank").exists(),
], async (req, res) => {
    let success = false
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
    }

    const { email, password } = req.body;
    try {
        let user = await User.findOne({ email });  //{email:email} === {email}
        if (!user) {
            return res.status(400).json({ success, error: "Try Logging in with correct credentials" });
        }

        const pwdCompare = await bcrypt.compare(password, user.password); // this return true false.
        if (!pwdCompare) {
            return res.status(400).json({ success, error: "Try Logging in with correct credentials" });
        }
        const data = {
            user: {
                id: user.id
            }
        }
        success = true;
        const authToken = jwt.sign(data, jwtSecret);
        res.json({ success, authToken })


    } catch (error) {
        console.error(error.message)
        res.send("Server Error")
    }
})

// Get logged in User details, Login Required.
router.post('/getuser', fetch, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).select("-password") // -password will not pick password from db.
        res.send(user)
    } catch (error) {
        console.error(error.message)
        res.send("Server Error")

    }
})
// Get logged in User details, Login Required.
router.post('/getlocation', async (req, res) => {
    try {
        let lat = req.body?.latlong?.lat
        let long = req.body?.latlong?.long
        let location = await axios
            .get("https://api.opencagedata.com/geocode/v1/json?q=" + lat + "+" + long + "&key=74c89b3be64946ac96d777d08b878d43")
            .then(async res => {
                let response = res.data.results[0].components;
                let { suburb, county, state_district, state, postcode } = response
                return String(suburb + "," + county + "," + state_district + "," + state + "\n" + postcode)
            })
            .catch(error => {
                console.error(error)
            })
        res.send({ location })

    } catch (error) {
        console.error(error.message)
        res.send("Server Error")

    }
})
router.get('/foodData', async (req, res) => {
    try {
        res.send({ foodData: global.foodData, foodCategory: global.foodCategory })
    } catch (error) {
        console.error(error.message)
        res.send("Server Error")

    }
})
router.get('/searchfoodData/:search', async (req, res) => {
    try {
        var query = req.params.search;
        var items = [];
        if (query.trim() === 'all') {
            items = await mongoose.connection.db.collection("food_items").find().toArray();
        }
        else {
            items = await mongoose.connection.db.collection("food_items").find({ 'name': { '$regex': new RegExp(query, 'i') } }).toArray();
        }
        return res.status(200).json({ serchItems: items })
    } catch (error) {
        console.error(error.message)
        res.send("Server Error")

    }
})

router.post('/orderData', async (req, res) => {
    let data = req.body.order_data
    await data.splice(0, 0, { Order_date: req.body.order_date })

    //if email not exisitng in db then create: else: InsertMany()
    let eId = await Order.findOne({ 'email': req.body.email })
    if (eId === null) {
        try {
            await Order.create({
                email: req.body.email,
                order_data: [data]
            }).then(() => {
                res.json({ success: true })
            })
        } catch (error) {
            res.send("Server Error", error.message)

        }
    }

    else {
        try {
            await Order.findOneAndUpdate({ email: req.body.email },
                { $push: { order_data: data } }).then(() => {
                    res.json({ success: true })
                })
        } catch (error) {
            res.send("Server Error", error.message)
        }
    }
})

router.post('/myOrderData', async (req, res) => {
    try {
        let eId = await Order.findOne({ 'email': req.body.email })
        res.json({ orderData: eId })
    } catch (error) {
        res.send("Error", error.message)
    }


});
router.get('/adminview', async (req, res) => {
    try {
        const userdata = await User.find({});
        return res.status(201).json(userdata, global.foodData, global.foodCategory);
    }
    catch (error) {
        res.send("Error", error.message)
    }
})
router.post('/adduseradmin', async (req, res) => {
    const { name, email, location, password } = req.body;
    try {
        const userexit = await User.findOne({
            email: email
        });
        const username = await User.findOne({
            name: name
        });
        if (userexit && username) {
            return res.status(422).json({
                error: "email & name is exits"
            });
        } else {
            const object = new User({
                name,
                email,
                location,
                password
            });
            //  hasing of password before save
            const a = await object.save();

            const userdata = await User.find({});
            return res.status(201).json(userdata);
        }
    } catch (err) {
    }
})
router.delete('/delteuseradmin', async (req, res) => {
    const { email } = req.body;
    try {
        const userexit = await User.findOne({
            email: email
        });
        if (userexit) {
            await User.deleteOne({ email: email });
            const userdata = await User.find({});
            return res.status(201).json(userdata);
        }
    } catch (err) {
    }
})
router.post('/edituseradmin/:email', async (req, res) => {
    try {
        const result = await User.updateOne({ email: req.params.email }, {
            $set: {
                name: req.body.name,
                email: req.body.email,
                location: req.body.location
            }
        }, { new: true })
        if (result.acknowledged) {

            return res.status(201).json(now)
        }
        return res.status(500).json({
            error: "something went wrong at server"
        })
    } catch (error) {
        return res.status(401).json(error);
    }
})
router.post('/payment', async (req, res) => {
    var body = req.body;
    if(typeof body.order_data === 'object'){
        body.order_data = [body.order_data];
    }
    var line_items = [];
    for (let i = 0; i < body.order_data.length; i++) {
        var orders = body.order_data[i];
        for (let j = 0; j < orders.length; j++) {
            var prod = orders[j];
            line_items.push(
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: prod.name,
                            // description: prod.description
                        },
                        unit_amount: prod.price * 10
                    },
                    quantity: prod.qty
                }
            )

        }
    }
    const customer = await stripe.customers.create({
  name: 'Jenny Rosen',
  address: {
    line1: '510 Townsend St',
    postal_code: '98140',
    city: 'San Francisco',
    state: 'CA',
    country: 'US',
  },
});
    const session = await stripe.checkout.sessions.create({
        
        payment_method_types: ['card'],
        line_items,
        mode: 'payment',
        success_url: 'http://localhost:3000/success',
        cancel_url: 'http://localhost:3000/cancel',
     
  customer_email: 'jashjash144@gmail.com',

})
        res.json({session})
        if(session){
            let data = req.body.order_data
    await data.splice(0, 0, { Order_date: req.body.order_date })

    //if email not exisitng in db then create: else: InsertMany()
    let eId = await Order.findOne({ 'email': req.body.email })
    if (eId === null) {
        try {
            await Order.create({
                email: req.body.email,
                order_data: [data]
            }).then(() => {
                // res.json({ success: true })
            })
        } catch (error) {
            // res.send("Server Error", error.message)

        }
    }

    else {
        try {
            await Order.findOneAndUpdate({ email: req.body.email },
                { $push: { order_data: data } }).then(() => {
                    // res.json({ success: true })
                })
        } catch (error) {
            // res.send("Server Error", error.message)
        }
    }
        }
})
module.exports = router