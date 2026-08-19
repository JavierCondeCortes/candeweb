export interface RoundResult {
  position: number;
  driverName: string;
  team: string | null;
  laps: number | null;
  totalTime: string | null;
  averageLap: string | null;
  incidents: number | null;
}

export interface RoundResultsResponse {
  sessionId: number;
  results: RoundResult[];
  sourceUrl: string;
  fetchedAt: string;
}
