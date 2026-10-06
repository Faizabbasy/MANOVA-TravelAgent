-- A won lead becomes exactly one project, even when the client retries after a lost response.
create unique index projects_one_per_lead on projects (lead_id) where lead_id is not null;
