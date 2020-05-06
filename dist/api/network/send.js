"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("../models");
const LND = require("../utils/lightning");
const msg_1 = require("../utils/msg");
const path = require("path");
const tribes = require("../utils/tribes");
const constants = require(path.join(__dirname, '../../config/constants.json'));
function signAndSend(opts) {
    return new Promise(function (resolve, reject) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!opts.data || typeof opts.data !== 'object') {
                return reject('object plz');
            }
            let data = JSON.stringify(opts.data);
            // SIGN HERE and append sig
            const sig = yield LND.signAscii(data);
            data = data + sig;
            console.log("DATA");
            console.log(opts.data);
            try {
                const payload = opts.data;
                if (payload.chat && payload.chat.type === constants.chat_types.tribe) {
                    // if owner pub to mqtt all group members (but not to self!!!)
                    const chatUUID = payload.chat.uuid;
                    const recipient = opts.dest;
                    if (!chatUUID || !recipient)
                        return;
                    const tribeOwnerPubKey = yield tribes.verifySignedTimestamp(chatUUID);
                    const owner = yield models_1.models.Contact.findOne({ where: { isOwner: true } });
                    if (owner.publicKey === tribeOwnerPubKey) {
                        tribes.publish(`${recipient}/${chatUUID}`, data);
                    }
                    else {
                        // else keysend to owner ONLY
                        if (recipient === tribeOwnerPubKey) {
                            LND.keysendMessage(Object.assign(Object.assign({}, opts), { data }));
                        }
                    }
                }
                else {
                    LND.keysendMessage(Object.assign(Object.assign({}, opts), { data }));
                }
            }
            catch (e) {
                throw e;
            }
        });
    });
}
exports.signAndSend = signAndSend;
function sendMessage(params) {
    return __awaiter(this, void 0, void 0, function* () {
        const { type, chat, message, sender, amount, success, failure } = params;
        const m = newmsg(type, chat, sender, message);
        const contactIds = (typeof chat.contactIds === 'string' ? JSON.parse(chat.contactIds) : chat.contactIds) || [];
        if (contactIds.length === 1) {
            if (contactIds[0] === 1) {
                return success(true); // if no contacts thats fine (like create tribe)
            }
        }
        let yes = null;
        let no = null;
        console.log('all contactIds', contactIds);
        yield asyncForEach(contactIds, (contactId) => __awaiter(this, void 0, void 0, function* () {
            if (contactId == sender.id) {
                return;
            }
            console.log('-> sending to contact #', contactId);
            const contact = yield models_1.models.Contact.findOne({ where: { id: contactId } });
            const destkey = contact.publicKey;
            const finalMsg = yield msg_1.personalizeMessage(m, contactId, destkey);
            const opts = {
                dest: destkey,
                data: finalMsg,
                amt: Math.max(amount, 3)
            };
            try {
                const r = yield signAndSend(opts);
                yes = r;
            }
            catch (e) {
                console.log("KEYSEND ERROR", e);
                no = e;
            }
        }));
        if (yes) {
            if (success)
                success(yes);
        }
        else {
            if (failure)
                failure(no);
        }
    });
}
exports.sendMessage = sendMessage;
function newmsg(type, chat, sender, message) {
    return {
        type: type,
        chat: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ uuid: chat.uuid }, chat.name && { name: chat.name }), (chat.type || chat.type === 0) && { type: chat.type }), chat.members && { members: chat.members }), chat.groupKey && { groupKey: chat.groupKey }), chat.host && { host: chat.host }),
        message: message,
    };
}
function asyncForEach(array, callback) {
    return __awaiter(this, void 0, void 0, function* () {
        for (let index = 0; index < array.length; index++) {
            yield callback(array[index], index, array);
        }
    });
}
//# sourceMappingURL=send.js.map