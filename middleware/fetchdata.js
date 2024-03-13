const express = require('express');
const { default: mongoose } = require('mongoose');

 const fetchdata = async (req,res,next) => {
    try{
    const userdata = await mongoose.connection.db.collection("food_items");
    const d= await userdata.find({}).toArray();
    const fc=await mongoose.connection.db.collection("foodCategory");
    const fd= await fc.find({}).toArray();
   res.send([d, fd]);
    }catch(err){
        console.log(err)
    }
}
module.exports=  fetchdata
