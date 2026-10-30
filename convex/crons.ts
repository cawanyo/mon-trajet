import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Rappels automatiques avant les trajets (45 minutes et 5 minutes)
crons.interval(
  "check-and-send-trip-reminders",
  { minutes: 1 },
  internal.trips.checkAndSendTripRemindersInternal
);

export default crons;
