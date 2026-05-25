export type ReplayStore = {
  get: (key: string) => boolean;
  set: (key: string, value: boolean) => void;
};

export const createInMemoryReplayStore = (maxRecords: number): ReplayStore => {
  const usedChallengeIds = new Set<string>();
  const challengeOrder: string[] = [];

  return {
    get: (key: string) => usedChallengeIds.has(key),
    set: (key: string, value: boolean) => {
      if (!value || usedChallengeIds.has(key)) return;

      usedChallengeIds.add(key);
      challengeOrder.push(key);

      if (challengeOrder.length > maxRecords) {
        const oldest = challengeOrder.shift();
        if (oldest) usedChallengeIds.delete(oldest);
      }
    },
  };
};
