export type Milestone = { name: string; done: boolean };

export type FileEntry = {
  path: string;
  purpose: string;
  createdAt: string;
  createdBy: string;
  modifiedAt: string;
  modifiedBy: string;
};

export type Registry = {
  appName: string;
  progress: {
    phase: string;
    percentComplete: number;
    summary: string;
    milestones: Milestone[];
  };
  files: FileEntry[];
};

/** Minimal repo metadata returned from the GitHub import endpoint. */
export type GitHubRepoSummary = {
  fullName: string;
  name: string;
  owner: string;
  htmlUrl: string;
  description: string;
  updatedAt: string;
  pushedAt: string;
  defaultBranch: string;
  private: boolean;
  fork: boolean;
};
