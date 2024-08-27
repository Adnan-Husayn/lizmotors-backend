import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authMiddleware } from './middleware/authMiddleware';
import { db } from './lib/db';
import { userRegisterSchema, userLoginSchema, videoProgressSchema } from './lib/validator';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/api/register', async (req: Request, res: Response) => {
  const parseResult = userRegisterSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.errors });
  }

  const { username, email, password } = parseResult.data;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await db.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
      },
    });
    return res.status(201).json({ message: 'User registered successfully', user }); // Added return here
  } catch (error) {
    return res.status(500).json({ error: 'Registration failed' }); // Added return here
  }
});

// Login route
app.post('/api/login', async (req: Request, res: Response) => {
  const parseResult = userLoginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.errors });
  }

  const { email, password } = parseResult.data;
  
  try {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
    return res.json({ token });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Fetch user progress
app.get('/api/progress', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.body.userId;
  try {
    const videosCompleted = await db.userVideoProgress.count({
      where: { userId, completed: true },
    });
    const totalVideos = await db.video.count();

    const progressPercentage = (videosCompleted / totalVideos) * 100;

    return res.json({ progressPercentage, videosCompleted, totalVideos });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// Fetch previously watched videos
app.get('/api/watched-videos', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.body.userId;
  try {
    const watchedVideos = await db.userVideoProgress.findMany({
      where: { userId, completed: true },
      include: { video: true },
    });

    return res.json(watchedVideos);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch watched videos' });
  }
});

// Update video progress
app.post('/api/update-progress', authMiddleware, async (req: Request, res: Response) => {
  const parseResult = videoProgressSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.errors });
  }

  const { videoId, lastPosition, completed, userId } = parseResult.data;

  try {
    const progress = await db.userVideoProgress.upsert({
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
  } catch (error) {
    console.error(error);  // Log the error for debugging
    return res.status(500).json({ error: 'Failed to update progress' });
  }
});

app.get('/api/current-module', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.body.userId;

  try {
    const currentProgress = await db.userVideoProgress.findFirst({
      where: { userId, completed: false },
      include: { video: { include: { module: true } } },
      orderBy: { createdAt: 'asc' }
    });

    if (!currentProgress) {
      return res.status(404).json({ message: 'No current progress found' });
    }

    // Convert BigInt to string
    const safeCurrentProgress = {
      ...currentProgress,
      id: currentProgress.id.toString(),  // Example for the progress ID
      video: {
        ...currentProgress.video,
        id: currentProgress.video.id.toString(), // Example for the video ID
        module: {
          ...currentProgress.video.module,
          id: currentProgress.video.module.id.toString(), // Example for the module ID
        },
      },
    };

    return res.json({ currentModule: safeCurrentProgress.video.module, videoProgress: safeCurrentProgress });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch current module' });
  }
});


app.post('/api/update-progress', authMiddleware, async (req: Request, res: Response) => {
  const parseResult = videoProgressSchema.safeParse(req.body);
  if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors });
  }

  const { videoId, lastPosition, completed, userId } = parseResult.data;

  try {
      const currentProgress = await db.userVideoProgress.findFirst({
          where: { userId, completed: false },
          orderBy: { createdAt: 'asc' }
      });

      if (!currentProgress || currentProgress.videoId !== videoId) {
          return res.status(400).json({ error: 'You cannot skip to this video' });
      }

      const progress = await db.userVideoProgress.update({
          where: { id: currentProgress.id },
          data: {
              lastPosition,
              completed,
              completedAt: completed ? new Date() : null,
          },
      });

      return res.json({ message: 'Progress updated successfully', progress });
  } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to update progress' });
  }
});

app.get('/api/next-module', authMiddleware, async (req: Request, res: Response) => {
  const currentSerialNumber = parseInt(req.query.currentSerialNumber as string, 10);

  try {
      const nextModule = await db.module.findFirst({
          where: { serialNumber: currentSerialNumber + 1 },
          include: { video: true },
      });

      if (!nextModule) {
          return res.status(404).json({ message: 'No next module found' });
      }

      let videoProgress = await db.userVideoProgress.findFirst({
          where: { userId: req.body.userId, video: { moduleId: nextModule.id } },
          orderBy: { createdAt: 'asc' },
      });

      // If no progress found, create a new progress entry
      if (!videoProgress) {
          videoProgress = await db.userVideoProgress.create({
              data: {
                  userId: req.body.userId,
                  videoId: nextModule.video[0].id,
                  lastPosition: 0,
                  completed: false,
              },
          });
      }

      return res.json({ nextModule, videoProgress });
  } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to fetch next module' });
  }
});





// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
