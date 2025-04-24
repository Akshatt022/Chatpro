const express = require('express');
const Router = express.Router()

Router.get('/',(req,res)=>{
    res.render('index');
})
Router.get('/call',(req,res)=>{
    res.render('call');
})
Router.get('/video',(req,res)=>{
    res.render('localvideo');
})

module.exports = Router;