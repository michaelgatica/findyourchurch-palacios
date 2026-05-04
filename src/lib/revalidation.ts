import { revalidatePath } from "next/cache";

export function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Revalidation is helpful, but it should never break a user-facing workflow.
    console.warn(`Skipping revalidatePath for "${path}": ${message}`);
  }
}
