export type Warehouse = 'snowflake' | 'bigquery' | 'postgres';

function dt(w: Warehouse, unit: 'day'|'week'): string {
  if (w === 'snowflake') return unit === 'day' ? "DATE_TRUNC('day', ts)" : "DATE_TRUNC('week', ts)";
  if (w === 'bigquery')  return unit === 'day' ? "DATE_TRUNC(ts, DAY)"   : "DATE_TRUNC(ts, WEEK)";
  return unit === 'day' ? "DATE_TRUNC('day', ts)" : "DATE_TRUNC('week', ts)"; // postgres
}

export function sqlForNode(
  nodeName: string,
  w: Warehouse,
  table='events',
  user='user_id',
  event='core_action'
): string {
  const n = nodeName.toLowerCase();

  // Activation rate
  if (n.includes('activation')) {
    if (w === 'bigquery') {
      return `
-- Activation Rate (example)
WITH signups AS (
  SELECT ${user}, DATE(TIMESTAMP_TRUNC(ts, DAY)) AS d
  FROM \`${table}\`
  WHERE event = 'signup'
),
activated AS (
  SELECT DISTINCT ${user}
  FROM \`${table}\`
  WHERE event = 'activation_event'
)
SELECT
  COUNTIF(${user} IN (SELECT ${user} FROM activated)) / COUNT(*) AS activation_rate
FROM signups
WHERE d >= DATE_SUB(CURRENT_DATE(), INTERVAL 28 DAY);`.trim();
    }
    return `
-- Activation Rate (example)
WITH signups AS (
  SELECT ${user}, ${dt(w,'day')} AS d FROM ${table}
  WHERE event = 'signup'
),
activated AS (
  SELECT DISTINCT ${user} FROM ${table}
  WHERE event = 'activation_event'
)
SELECT
  AVG(CASE WHEN ${user} IN (SELECT ${user} FROM activated) THEN 1 ELSE 0 END) AS activation_rate
FROM signups
WHERE d >= CURRENT_DATE - INTERVAL '28 days';`.trim();
  }

  // 7d retention
  if (n.includes('retention') || n.includes('d7')) {
    return `
-- 7-day Retention (example)
WITH first_use AS (
  SELECT ${user}, MIN(${dt(w,'day')}) AS d0 FROM ${table} GROUP BY ${user}
),
d7 AS (
  SELECT DISTINCT ${user}
  FROM ${table} e
  JOIN first_use f USING(${user})
  WHERE ${dt(w,'day')} BETWEEN f.d0 + INTERVAL '7 days' AND f.d0 + INTERVAL '13 days'
)
SELECT
  COUNT(*) FILTER (WHERE ${user} IN (SELECT ${user} FROM d7))::float
  / COUNT(*) AS retention_7d
FROM first_use;`.trim();
  }

  // Referral rate
  if (n.includes('referral')) {
    return `
-- Referral Rate (example)
WITH invites AS (
  SELECT ${user}, ${dt(w,'day')} AS d FROM ${table}
  WHERE event = 'invite_sent'
),
accepted AS (
  SELECT ${user}, ${dt(w,'day')} AS d FROM ${table}
  WHERE event = 'invite_accepted'
)
SELECT
  COUNT(*)::float / NULLIF((SELECT COUNT(*) FROM invites),0) AS referral_accept_rate
FROM accepted
WHERE d >= CURRENT_DATE - INTERVAL '28 days';`.trim();
  }

  // WAU
  return `
-- Weekly Active Users (WAU) (example)
WITH actives AS (
  SELECT DISTINCT ${user}, ${dt(w,'week')} AS wk
  FROM ${table}
  WHERE event = '${event}' AND ts >= CURRENT_DATE - INTERVAL '56 days'
)
SELECT wk, COUNT(DISTINCT ${user}) AS wau
FROM actives
GROUP BY 1
ORDER BY 1 DESC;`.trim();
}
