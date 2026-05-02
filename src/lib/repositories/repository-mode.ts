import { isFirebaseAdminAvailable } from "@/lib/firebase/admin";
import type { RepositoryMode } from "@/lib/types/directory";

export function getRepositoryMode(): RepositoryMode {
  return isFirebaseAdminAvailable() ? "firebase" : "local";
}
