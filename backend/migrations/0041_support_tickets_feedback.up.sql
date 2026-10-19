-- S12c-2: client support tickets (with staff replies and internal notes) and trip feedback, both API-owned.
create table support_tickets (
  id               text primary key check (id <> ''),
  party_id         text not null references parties (id),
  project_id       text references projects (id),
  category         text not null check (category in ('reservation', 'participant', 'document', 'billing', 'operational', 'complaint', 'emergency', 'technical', 'service-quality')),
  priority         text not null check (priority in ('low', 'medium', 'high', 'urgent')),
  status           text not null check (status in ('open', 'assigned', 'in-progress', 'waiting-for-client', 'resolved', 'closed', 'reopened')),
  subject          text not null check (btrim(subject) <> ''),
  description      text not null check (btrim(description) <> ''),
  attachment_name  text,
  created_by       text not null references users (id),
  assigned_to      text references users (id),
  resolution_note  text,
  resolved_by      text references users (id),
  resolved_at      timestamptz,
  resolution_rating smallint check (resolution_rating between 1 and 5),
  rating_note      text,
  reopen_count     integer not null default 0 check (reopen_count >= 0),
  closed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index support_tickets_party on support_tickets (party_id);
create index support_tickets_status on support_tickets (status);

create table support_ticket_replies (
  id              text primary key check (id <> ''),
  ticket_id       text not null references support_tickets (id),
  author_user_id  text not null references users (id),
  message         text not null check (btrim(message) <> ''),
  attachment_name text,
  is_internal     boolean not null default false,
  created_at      timestamptz not null default now()
);
create index support_ticket_replies_ticket on support_ticket_replies (ticket_id);

create table project_feedback (
  id                          text primary key check (id <> ''),
  project_id                  text not null unique references projects (id),
  party_id                    text not null references parties (id),
  status                      text not null check (status in ('draft', 'submitted', 'acknowledged', 'follow-up-required', 'closed')),
  overall_experience          smallint check (overall_experience between 1 and 5),
  recommendation_score        smallint check (recommendation_score between 0 and 10),
  sales_responsiveness        smallint check (sales_responsiveness between 1 and 5),
  proposal_quality            smallint check (proposal_quality between 1 and 5),
  itinerary_quality           smallint check (itinerary_quality between 1 and 5),
  hotel_rating                smallint check (hotel_rating between 1 and 5),
  transportation_rating       smallint check (transportation_rating between 1 and 5),
  tour_leader_rating          smallint check (tour_leader_rating between 1 and 5),
  operation_support_rating    smallint check (operation_support_rating between 1 and 5),
  reservation_handling_rating smallint check (reservation_handling_rating between 1 and 5),
  communication_rating        smallint check (communication_rating between 1 and 5),
  issue_resolution_rating     smallint check (issue_resolution_rating between 1 and 5),
  value_for_money_rating      smallint check (value_for_money_rating between 1 and 5),
  comment                     text,
  improvement_suggestion      text,
  testimonial_consent         boolean not null default false,
  created_by                  text not null references users (id),
  submitted_by                text references users (id),
  submitted_at                timestamptz,
  acknowledged_by             text references users (id),
  acknowledged_at             timestamptz,
  follow_up_note              text,
  closed_at                   timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  check (status = 'draft' or (overall_experience is not null and recommendation_score is not null and submitted_at is not null))
);
