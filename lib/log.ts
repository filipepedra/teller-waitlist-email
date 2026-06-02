type LogFields = {
  level: "info" | "warn" | "error";
  event: string;
  [key: string]: unknown;
};

export function log(fields: LogFields) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...fields });
  if (fields.level === "error") {
    console.error(line);
  } else if (fields.level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}
