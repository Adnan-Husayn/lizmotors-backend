"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoProgressSchema = exports.userLoginSchema = exports.userRegisterSchema = void 0;
const zod_1 = require("zod");
exports.userRegisterSchema = zod_1.z.object({
    username: zod_1.z.string().min(3),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
exports.userLoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
exports.videoProgressSchema = zod_1.z.object({
    videoId: zod_1.z.string().uuid(),
    lastPosition: zod_1.z.number().min(0),
    completed: zod_1.z.boolean(),
    userId: zod_1.z.string().uuid(),
});
//# sourceMappingURL=validator.js.map