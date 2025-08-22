-- depends_on: {{ ref('signups_daily') }}
-- depends_on: {{ ref('activation_events') }}
with signups as (
  select user_id, date_trunc('day', ts) as d
  from {{ source('app', 'events') }}
  where event = 'signup'
),
activated as (
  select distinct user_id
  from {{ source('app', 'events') }}
  where event = 'activation_event'
)
select
  avg(case when user_id in (select user_id from activated) then 1 else 0 end) as activation_rate
from signups
where d >= current_date - interval '28 days';
