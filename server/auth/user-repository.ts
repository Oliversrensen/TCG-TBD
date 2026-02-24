import { prisma } from "../prisma/client.js";

export interface UserRecord {
  id: string;
  username: string;
}

export async function createUser(id: string, username: string): Promise<UserRecord> {
  return prisma.user.create({
    data: { id, username },
  });
}

export async function findById(id: string): Promise<UserRecord | null> {
  return prisma.user.findUnique({
    where: { id },
  });
}

export async function getOrCreateUserFromNeon(neonUserId: string, username: string): Promise<UserRecord> {
  const existing = await findById(neonUserId);
  if (existing) {
    return existing;
  }
  return createUser(neonUserId, username);
}

