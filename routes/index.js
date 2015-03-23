const express = require('express');
const router = express.Router();

const schemes = {
    'text6': {
        gen: function() {

            const max = 36;
            const min = 9;
            return new Array(6).map(function() {
                return ((Math.random() * (max - min) + min) | 0).toString(max);
            }).join();
        }
    }
};
const userDB = require('../dbs/user-db')(Object.keys(schemes));

const domains = [ 'Email', 'Facebook', 'Banking' ];

// GETS THE HOME PAGE.
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Password Experiment' });
});

router.get('/new-user', function(req, res, next) {

    userDB.newUser(function(error, user) {

        if (error) {
            var data = {
                message: 'An error occurred while making a new user',
                error: new Error(error)
            };
            res.render('error', data);
            return;
        }

        
    });
});

module.exports = router;
