const express = require('express');
const router = express.Router();
const syllableParts = require('syllables.json');

const schemes = {
    'text6': {
        gen: function() {

            const max = 36;
            const min = 10;
            return new Array(6).map(function() {
                return ((Math.random() * (max - min) + min) | 0).toString(max);
            }).join();
        }
    },
    'syllable2': {
        gen: function() {
            var password = '';
            for (i = 0; i < 2; ++i) {
                password = password.concat(syllableParts.onset[(Math.random() * syllableParts.onset.length) | 0]);
                password = password.concat(syllableParts.nucleus[(Math.random() * syllableParts.nucleus.length) | 0]);
                password = password.concat(syllableParts.coda[(Math.random() * syllableParts.coda.length) | 0]);
            }
            return password;
        }
    }
};
const userDB = require('../dbs/user-db')(Object.keys(schemes));

const domains = [ 'Email', 'Facebook', 'Banking' ];

// GETS THE HOME PAGE
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Password Experiment' });
});

// CREATES A NEW USER AND GENERATES PASSWORDS FOR THE USER
router.post('/new-user', function(req, res, next) {

    userDB.newUser(function(error, user) {

        var errData = {
            title: 'Error',
            message: 'An error occurred while making a new user'
        };

        if (error) {
            errData.error = new Error(error);
            res.render('error', errData);
            return;
        }

        const pws = domains.map(function(domain) {
            return {
                userId: user.uid,
                domain: domain,
                password: schemes[user.scheme].gen()
            };
        });
        
        userDB.addPasswords(pws, function(error) {

            if (error) {
                errData.error = new Error(error);
                res.render('error', errData);
                return;
            }

            res.redirect('/new-user/' + user.uid);
        });
    });
});

// DISPLAYS THE NEW USER'S ID
router.get('/new-user/:userId', function(req, res, next) {
    res.render('new-user', { title: 'Successfully created user!', userId: req.params.userId });
});

module.exports = router;
