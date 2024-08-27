import { z } from 'zod';

export const userRegisterSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
});

export const userLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const videoProgressSchema = z.object({
  videoId: z.string().uuid(),
  lastPosition: z.number().min(0),
  completed: z.boolean(),
  userId: z.string().uuid(),
});

export type UserRegisterSchema = z.infer<typeof userRegisterSchema>;
export type UserLoginSchema = z.infer<typeof userLoginSchema>;
export type VideoProgressSchema = z.infer<typeof videoProgressSchema>;
