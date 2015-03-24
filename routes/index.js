const express = require('express');
const router = express.Router();
const syllableParts = require('syllables.json');

const schemes = {
    'text6': {
        gen: function() {

            const max = 36;
            const min = 10;
            var arr = [];
            for (var i = 0; i < 6; ++i) {
                arr.push(((Math.random() * (max - min) + min) | 0).toString(max));
            }
            return arr.join('');
        }
    },
    'syllable2': {
        gen: function() {
            var password = '';
            for (var i = 0; i < 2; ++i) {
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

        if (error) throw error;

        const pws = domains.map(function(domain) {
            return {
                userId: user.uid,
                domain: domain,
                password: schemes[user.scheme].gen()
            };
        });
        
        userDB.addPasswords(pws, function(error) {

            if (error) throw error;

            res.redirect('/new-user/' + user.uid);
        });
    });
});

// DISPLAYS THE NEW USER'S ID
router.get('/new-user/:userId', function(req, res, next) {
    res.render('new-user', { title: 'Successfully created user!', userId: req.params.userId });
});

// POSTS THE USER ID TO START PRACTICING WITH
router.post('/practice', function(req, res, next) {
    res.redirect('/practice/' + req.body.userId + '/' + domains[0]);
});

// GETS THE APPROPRIATE ITEM TO PRACTICE
router.get('/practice/:userId/:domain', function(req, res, next) {

    userDB.getPwInfo({ userId: req.params.userId, domain: req.params.domain }, function(error, info) {

        if (error) throw error;
        if (!info) throw 'No record found for UserID=' + req.params.userId + ', Domain=' + req.params.domain;

        var data = {
            title: 'Learn your ' + req.params.domain + ' password',
            userId: req.params.userId,
            domain: req.params.domain,
            password: info.password,
            pwError: req.query.pwError
        };

        res.render('practice-' + info.scheme, data);
    });
});

// POSTS TO THE CURRENT DOMAIN TO CONFIRM THE PASSWORD
router.post('/practice/:userId/:domain', function(req, res, next) {

    var data = {
        userId: req.params.userId,
        domain: req.params.domain,
        password: req.body.password
    };
    userDB.checkPassword(data, function(error, didMatch) {

        if (error) throw error;

        if (didMatch) {
            const nextDom = domains[domains.indexOf(data.domain) + 1];
            if (nextDom) {
                res.redirect('/practice/' + data.userId + '/' + nextDom);
            }
            else {
                res.redirect('/practice/' + data.userId);
            }
        }
        else {
            res.redirect('/practice/' + data.userId + '/' + data.domain + '?pwError=Incorrect Password');
        }
    });
});

// GETS THE PRACTICE COMPLETION PAGE
router.get('/practice/:userId', function(req, res, next) {
    res.render('practice-complete', { title: 'Password practice complete!', userId: req.params.userId });
});

// POSTS TO START THE LOGIN PROCESS
router.post('/login', function(req, res, next) {

    throw 'TODO - Implement login';
});

module.exports = router;