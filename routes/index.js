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
        },
        check: function(raw, stored) {
            return raw === stored;
        }
    },
    'syllable2': {
        gen: function() {

            var arr = [];
            for (var i = 0; i < 2; ++i) {
                var syl = syllableParts.onset[(Math.random() * syllableParts.onset.length) | 0] +
                    syllableParts.nucleus[(Math.random() * syllableParts.nucleus.length) | 0] +
                    syllableParts.coda[(Math.random() * syllableParts.coda.length) | 0];
                arr.push(syl);
            }
            return arr.join('*');
        },
        check: function(raw, stored) {
            return raw === stored.replace('*', '');
        }
    }
};
const userDB = require('../dbs/user-db')(Object.keys(schemes));

const domains = [ 'Email', 'Facebook', 'Banking' ];
function nextDomain(curr) { return domains[domains.indexOf(curr) + 1]; }

const MAX_ATTEMPTS = 3;

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

// GETS THE APPROPRIATE DOMAIN TO PRACTICE
router.get('/practice/:userId/:domain', function(req, res, next) {

    var data = {
        userId: req.params.userId,
        domain: req.params.domain
    };

    userDB.getPwInfo(data, function(error, info) {

        if (error) throw error;
        if (!info) throw 'No record found for UserID=' + req.params.userId + ', Domain=' + req.params.domain;

        data.title = 'Learn your ' + req.params.domain + ' password',
        data.password = info.password,
        data.pwError = req.query.pwError

        res.render('practice-' + info.scheme, data);
    });
});

// POSTS TO THE CURRENT DOMAIN TO CONFIRM THE PASSWORD
router.post('/practice/:userId/:domain', function(req, res, next) {

    var data = {
        userId: req.params.userId,
        domain: req.params.domain
    };

    userDB.getPwInfo(data, function(error, info) {

        if (error) throw error;

        if (schemes[info.scheme].check(req.body.password, info.password)) {
            const nextDom = nextDomain(data.domain);
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
    res.redirect('/login/' + req.body.userId + '/' + domains[0]);
});

// GETS THE APPROPRIATE DOMAIN TO LOGIN TO
router.get('/login/:userId/:domain', function(req, res, next) {

    var data = {
        userId: req.params.userId,
        domain: req.params.domain
    };

    userDB.getPwInfo(data, function(error, info) {

        data.title = 'Enter your ' + data.domain + ' password';
        data.pwError = req.query.pwError
        data.attemptsLeft = Math.max(0, MAX_ATTEMPTS - info.attemptNum);

        if (data.attemptsLeft <= 0) {
            data.nextDomain = nextDomain(data.domain);
            data.title = 'Login to ' + data.domain + ' unsuccessful';
        }

        res.render('login-' + info.scheme, data);
    });
});

// POSTS TO THE CURRENT DOMAIN TO ATTEMPT THE LOGIN
router.post('/login/:userId/:domain', function(req, res, next) {

    var data = {
        userId: req.params.userId,
        domain: req.params.domain
    };

    userDB.attemptPassword(data, function(error, info) {

        if (error) throw error;

        if (schemes[info.scheme].check(req.body.password, info.password)) {
            const nextDom = nextDomain(data.domain);
            if (nextDom) {
                res.redirect('/login/' + data.userId + '/' + nextDom);
            }
            else {
                res.redirect('/login/' + data.userId);
            }
        }
        else {
            res.redirect('/login/' + data.userId + '/' + data.domain + '?pwError=Incorrect Password');
        }
    });
});

// GETS THE LOGIN COMPLETION PAGE
router.get('/login/:userId', function(req, res, next) {
    res.render('login-complete', { title: 'Login Process Complete' });
});

module.exports = router;