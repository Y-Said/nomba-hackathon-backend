
const { DatabaseSync } = require("node:sqlite")
const uuid = require("uuid")

class DB {
    db = null

    constructor() {
        this.db = new DatabaseSync("../database.sqlite")

    }

    createUser(uniqueId) {

        let stm = this.db.prepare("insert into subscribers (uniqueID,verified,nextBilling) values(?,?,?)")
        let now = new Date().toLocaleDateString();
        stm.run(uniqueId, 0, now)
        return true
    }

    createOrder(uniqueId, orderId) {
        let stm = this.db.prepare("insert into orderId(orderId,userUniqueId) values(?,?)")
        stm.run(orderId,uniqueId)

    }

    getOrder(orderId) {
        let stm = this.db.prepare("select * from orderId where orderId = ?")
        let result = stm.get(orderId);
        return result
    }

    billUser(unique) {
        let data = this.getOrder(unique)
        console.log(data)
        let userID = data.userUniqueId
        var billingCycle = new Date()
        billingCycle.setMonth(billingCycle.getMonth() + 1);
        let nextBilling = billingCycle.toUTCString();
        let stm = this.db.prepare("update subscribers set verified=1, nextBilling=? where uniqueID = ?")
        stm.run(nextBilling,userID)
        return true;
    }


    notDuplicate(requestId) {
        let stm = this.db.prepare("select * from transactions where transactionId = ?")
        let result = stm.get(requestId)
        return result != null
    }

    createTransaction(uniqueID) {
        let stm = this.db.prepare("insert into transactions(transactionsId,uniqueId,transactionTime) values(?,?,?)")
        stm.run(uniqueID, 0, new Date().toLocaleString())


    }

    checkUserBilling(userID) {
        let stm = this.db.prepare("select * from subscribers where uniqueID = ?");
        let result = stm.all(userID)
        console.log("billing", result, userID)
        let now = new Date()
        let oldBilling = new Date(result.nextBilling)

        return now - oldBilling <= (24 * 60 * 60 * 1000 * 30)



    }

    allUsers() {
        let stm = this.db.prepare("select * from subscribers");
        let result = stm.all()
        return result

    }

    updateUser(uniqueID) {
        let stm = this.db.prepare("update subscribers set verified='0' where uniqueID=?")
        stm.run(uniqueID)
        return true
    }


    getTodayPodcast(uniqueID) {
        if (!this.checkUserBilling(uniqueID)) {
            this.updateUser(uniqueID)
        }

        let stm = this.db.prepare("select * from podcast");
        let result = stm.all()
        console.log(result)

        let podcasts = {};
        podcasts["heading"] = [result[0], result[1], result[2], result[3]]
        podcasts['technology'] = [result[0], result[3], result[4]]
        podcasts["trending"] = [result[0], result[0], result[2]]
        podcasts["politics"] = [result[0], result[5], result[6]]
        return podcasts
    }

}

module.exports.DB = DB