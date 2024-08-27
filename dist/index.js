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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authMiddleware_1 = require("./middleware/authMiddleware");
const db_1 = require("./lib/db");
const validator_1 = require("./lib/validator");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
// Middleware
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: true }));
app.post('/api/register', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const parseResult = validator_1.userRegisterSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors });
    }
    const { username, email, password } = parseResult.data;
    try {
        const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        const user = yield db_1.db.user.create({
            data: {
                username,
                email,
                password: hashedPassword,
            },
        });
        return res.status(201).json({ message: 'User registered successfully', user }); // Added return here
    }
    catch (error) {
        return res.status(500).json({ error: 'Registration failed' }); // Added return here
    }
}));
// Login route
app.post('/api/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const parseResult = validator_1.userLoginSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors });
    }
    const { email, password } = parseResult.data;
    try {
        const user = yield db_1.db.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const isPasswordValid = yield bcryptjs_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
        return res.json({ token });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ error: 'Login failed' });
    }
}));
// Fetch user progress
app.get('/api/progress', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.body.userId;
    try {
        const videosCompleted = yield db_1.db.userVideoProgress.count({
            where: { userId, completed: true },
        });
        const totalVideos = yield db_1.db.video.count();
        const progressPercentage = (videosCompleted / totalVideos) * 100;
        return res.json({ progressPercentage, videosCompleted, totalVideos });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch progress' });
    }
}));
// Fetch previously watched videos
app.get('/api/watched-videos', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.body.userId;
    try {
        const watchedVideos = yield db_1.db.userVideoProgress.findMany({
            where: { userId, completed: true },
            include: { video: true },
        });
        return res.json(watchedVideos);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch watched videos' });
    }
}));
// Update video progress
app.post('/api/update-progress', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const parseResult = validator_1.videoProgressSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors });
    }
    const { videoId, lastPosition, completed, userId } = parseResult.data;
    try {
        const progress = yield db_1.db.userVideoProgress.upsert({
            where: {
                userId_videoId: {
                    userId,
                    videoId,
                },
            },
            update: {
                lastPosition,
                completed,
                completedAt: completed ? new Date() : null,
            },
            create: {
                userId,
                videoId,
                lastPosition,
                completed,
                completedAt: completed ? new Date() : null,
            },
        });
        return res.json({ message: 'Progress updated successfully', progress });
    }
    catch (error) {
        console.error(error); // Log the error for debugging
        return res.status(500).json({ error: 'Failed to update progress' });
    }
}));
app.get('/api/current-module', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.body.userId;
    try {
        const currentProgress = yield db_1.db.userVideoProgress.findFirst({
            where: { userId, completed: false },
            include: { video: { include: { module: true } } },
            orderBy: { createdAt: 'asc' }
        });
        if (!currentProgress) {
            return res.status(404).json({ message: 'No current progress found' });
        }
        // Convert BigInt to string
        const safeCurrentProgress = Object.assign(Object.assign({}, currentProgress), { id: currentProgress.id.toString(), video: Object.assign(Object.assign({}, currentProgress.video), { id: currentProgress.video.id.toString(), module: Object.assign(Object.assign({}, currentProgress.video.module), { id: currentProgress.video.module.id.toString() }) }) });
        return res.json({ currentModule: safeCurrentProgress.video.module, videoProgress: safeCurrentProgress });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Failed to fetch current module' });
    }
}));
app.post('/api/update-progress', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const parseResult = validator_1.videoProgressSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors });
    }
    const { videoId, lastPosition, completed, userId } = parseResult.data;
    try {
        const currentProgress = yield db_1.db.userVideoProgress.findFirst({
            where: { userId, completed: false },
            orderBy: { createdAt: 'asc' }
        });
        if (!currentProgress || currentProgress.videoId !== videoId) {
            return res.status(400).json({ error: 'You cannot skip to this video' });
        }
        const progress = yield db_1.db.userVideoProgress.update({
            where: { id: currentProgress.id },
            data: {
                lastPosition,
                completed,
                completedAt: completed ? new Date() : null,
            },
        });
        return res.json({ message: 'Progress updated successfully', progress });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Failed to update progress' });
    }
}));
app.get('/api/next-module', authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const currentSerialNumber = parseInt(req.query.currentSerialNumber, 10);
    try {
        const nextModule = yield db_1.db.module.findFirst({
            where: { serialNumber: currentSerialNumber + 1 },
            include: { video: true },
        });
        if (!nextModule) {
            return res.status(404).json({ message: 'No next module found' });
        }
        const videoProgress = yield db_1.db.userVideoProgress.findFirst({
            where: { userId: req.body.userId, video: { moduleId: nextModule.id } },
            orderBy: { createdAt: 'asc' },
        });
        return res.json({ nextModule, videoProgress });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Failed to fetch next module' });
    }
}));
// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map