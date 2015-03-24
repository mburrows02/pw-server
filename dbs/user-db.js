const sqlite3 = require('sqlite3');
const db = new sqlite3.Database(':memory:');

// ========================================================================= //
// DB CONSTANTS                                                              //
// ========================================================================= //

// USERS TABLE
const USERS_TABLE = 'USERS';
const USER_ID_COL = 'UserID';
const USER_PW_SCHEME_COL = 'Scheme';

// PASSWORDS TABLE
const PASSWORDS_TABLE = 'PASSWORDS';
const PASSWORD_USER_ID_COL = 'UserID';
const PASSWORD_DOMAIN_COL = 'Domain';
const PASSWORD_VALUE_COL = 'Password';
const PASSWORD_NUM_ATTEMPTS_COL = 'NumAttempts';

// ========================================================================= //
// EXPORT                                                                    //
// ========================================================================= //

module.exports = function(schemes) {

    // ========================================================================= //
    // RETURNS OBJECT                                                            //
    // ========================================================================= //

    var userDB = {};

    // ========================================================================= //
    // DB ACCESS METHODS                                                         //
    // ========================================================================= //

    // GETS THE USERS INFO
    //
    //  userId = <int>
    //  callback(error, user)
    //  user = { uid: <int>, scheme: <string> }
    userDB.getUser = function(userId, callback) {

        db.get('SELECT ' + USER_ID_COL + ' AS uid, ' + USER_PW_SCHEME_COL + ' AS scheme FROM ' + 
            USERS_TABLE + ' WHERE ' + USER_ID_COL + ' = $uid;', { $uid: userId }, callback);
    };

    // CREATES AND RETURNS A NEW USER
    //
    //  callback(error, user)
    //  user = { uid: <int>, scheme: <string> }
    userDB.newUser = function(callback) {

        const stmt = 'SELECT ' + USER_PW_SCHEME_COL + ' AS scheme, count(' + USER_PW_SCHEME_COL + ') AS count FROM ' +
            USERS_TABLE + ' GROUP BY ' + USER_PW_SCHEME_COL + ';';

        // Counts the number of times each scheme is used.
        db.all(stmt, function(error, schemeCounts) {

            if (error) {
                callback(error);
                return;
            }

            // Converts the array to an object and includes any potentially missing schemes.
            schemeCounts = schemeCounts.reduce(function(prev, curr) {

                prev[curr.scheme] = curr.count;
                return prev;
            }, schemes.reduce(function(prev, curr) {

                prev[curr] = 0;
                return prev;
            }, {}));

            // Finds the scheme to use for the new user.
            const toUse = schemes.reduce(function(prev, curr) {

                currScheme = { name: curr, count: schemeCounts[curr] };

                if (prev.count !== undefined && prev.count <= currScheme.count) {
                    return prev;
                }
                return currScheme;
            }, {}).name;

            const stmt = 'INSERT INTO ' + USERS_TABLE + ' (' + USER_PW_SCHEME_COL + ') VALUES ($scheme);';

            // Creates the new user.
            db.run(stmt, { $scheme: toUse }, function(error) {

                if (error) {
                    callback(error);
                    return;
                }

                db.get('SELECT ' + USER_ID_COL + ' AS uid, ' + USER_PW_SCHEME_COL + ' AS scheme FROM ' + USERS_TABLE +
                    ' WHERE rowid = $rowId;', { $rowId: this.lastID }, callback);
            });
        });
    };

    // GETS THE PASSWORD FOR THE GIVEN USER
    //
    //  data = {
    //      userId: <int>,
    //      domain: <string>
    //  }
    //  callback(error, info)
    //  info = {
    //      password: <string>,
    //      scheme: <string>,
    //      attemptNum: <int>
    //  }
    userDB.getPwInfo = function(data, callback) {

        const stmt = 'SELECT ' + PASSWORD_VALUE_COL + ' AS password, ' + PASSWORD_NUM_ATTEMPTS_COL + ' AS attemptNum, ' +
            USER_PW_SCHEME_COL + ' AS scheme FROM ' + PASSWORDS_TABLE + ' NATURAL JOIN ' + USERS_TABLE +
            ' WHERE ' + PASSWORD_USER_ID_COL + ' = $uid AND ' + PASSWORD_DOMAIN_COL + ' = $dom;';

        db.get(stmt, { $uid: data.userId, $dom: data.domain }, callback);
    };

    // INSERTS A NEW PASSWORD
    //
    //  pws = [ pw, ... ]
    //  pw = {
    //      userId: <int>,
    //      domain: <string>,
    //      password: <string>
    //  }
    //  callback(error)
    userDB.addPasswords = function(pws, callback) {

        const values = pws.map(function(pw, index) {

            const fields = ['userId', 'domain', 'password'];
            return {
                str: fields.map(function(item) { return '$' + index + item }).join(', '),
                params: fields.map(function(item) { return { name: '$' + index + item, value: pw[item] }; })
            };
        });

        const data = values.reduce(function(prev, curr) {

            return curr.params.reduce(function(prev, curr) {
                prev[curr.name] = curr.value;
                return prev;
            }, prev);
        }, {})

        const stmt = 'INSERT INTO ' + PASSWORDS_TABLE + ' (' + PASSWORD_USER_ID_COL + ', ' + PASSWORD_DOMAIN_COL + ', ' + PASSWORD_VALUE_COL
            + ') VALUES (' + values.map(function(item) { return item.str; }).join('), (') + ')';

        db.run(stmt, data, callback);
    };

    // CHECKS THE PASSWORD AND REGISTERS AN ATTEMPT
    //
    //  data = {
    //      userId: <int>,
    //      domain: <string>,
    //      password: <string>
    //  }
    //  callback(error, result)
    //  result = { didMatch: <boolean>, attemptNum: <int> }
    userDB.attemptPassword = function(data, callback) {

        const stmt = 'UPDATE ' + PASSWORDS_TABLE + ' SET ' + PASSWORD_NUM_ATTEMPTS_COL + ' = ' + PASSWORD_NUM_ATTEMPTS_COL + ' + 1' +
            ' WHERE ' + PASSWORD_USER_ID_COL + ' = $uid AND ' + PASSWORD_DOMAIN_COL + ' = $dom;';

        db.run(stmt, { $uid: data.userId, $dom: data.domain }, function(error) {

            if (error) {
                callback(error);
                return;
            }

            const stmt = 'SELECT ' + PASSWORD_VALUE_COL + ', ' + PASSWORD_NUM_ATTEMPTS_COL + ' FROM ' + PASSWORDS_TABLE +
                ' WHERE ' + PASSWORD_USER_ID_COL + ' = $uid AND ' + PASSWORD_DOMAIN_COL + ' = $dom;';

            db.get(stmt, { $uid: data.userId, $dom: data.domain }, function(error, row) {

                var result = undefined;

                if (row) {
                    result = { didMatch: row[PASSWORD_VALUE_COL] === data.password, attemptNum: row[PASSWORD_NUM_ATTEMPTS_COL] };
                }

                callback(error, result);
            });
        })
    };

    // CHECKS WHETHER THE PASSWORD IS CORRECT
    //
    //  data = {
    //      userId: <int>,
    //      domain: <string>,
    //      password: <string>
    //  }
    //  callback(error, didMatch)
    userDB.checkPassword = function(data, callback) {

        const stmt = 'SELECT * FROM ' + PASSWORDS_TABLE + ' WHERE ' + PASSWORD_USER_ID_COL + ' = $uid AND ' +
            PASSWORD_DOMAIN_COL + ' = $dom AND ' + PASSWORD_VALUE_COL + ' = $pw;';

        db.get(stmt, { $uid: data.userId, $dom: data.domain, $pw: data.password }, function(error, row) {

            callback(error, row ? true : false);
        });
    };

    return userDB;
};

// ========================================================================= //
// INITIALIZATION                                                            //
// ========================================================================= //

// Creates the USERS table.
db.run('CREATE TABLE IF NOT EXISTS ' + USERS_TABLE + ' (' +
    USER_ID_COL + ' INTEGER NOT NULL PRIMARY KEY, ' +
    USER_PW_SCHEME_COL + ' TEXT NOT NULL COLLATE NOCASE);');

// Creates the PASSWORDS table.
db.run('CREATE TABLE IF NOT EXISTS ' + PASSWORDS_TABLE + ' (' +
    PASSWORD_USER_ID_COL + ' INTEGER NOT NULL REFERENCES ' + USERS_TABLE + ' (' + USER_ID_COL + '), ' +
    PASSWORD_DOMAIN_COL + ' TEXT NOT NULL COLLATE NOCASE, ' +
    PASSWORD_VALUE_COL + ' TEXT NOT NULL, ' +
    PASSWORD_NUM_ATTEMPTS_COL + ' INTEGER NOT NULL DEFAULT 0, ' + 
    'PRIMARY KEY (' + PASSWORD_USER_ID_COL + ', ' + PASSWORD_DOMAIN_COL + '));')