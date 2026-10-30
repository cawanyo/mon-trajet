import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Rappels automatiques avant les trajets (45 minutes et 5 minutes)
crons.interval(
  "check-and-send-trip-reminders",
  { minutes: 1 },
  internal.trips.checkAndSendTripRemindersInternal
);

// Cycle de vie des demandes ouvertes (notification 30 min avant et suppression 30 min après)
crons.interval(
  "check-and-process-open-demands",
  { minutes: 1 },
  internal.requests.processOpenDemandsLifecycleInternal
);

export default crons;
