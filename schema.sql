--
-- PostgreSQL database dump
--

\restrict QWCjykknvwjXMZ6DJW4M04SQiNJahrB3XmJ6YI8WPzO0mCmymRYWpa8OSHsPbMh

-- Dumped from database version 16.13 (Debian 16.13-1.pgdg13+1)
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: blended_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blended_rates (
    id bigint NOT NULL,
    onshore_rate numeric(10,2) NOT NULL,
    offshore_rate numeric(10,2) NOT NULL,
    effective_date date NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by bigint NOT NULL,
    CONSTRAINT blended_rates_offshore_rate_check CHECK ((offshore_rate > (0)::numeric)),
    CONSTRAINT blended_rates_onshore_rate_check CHECK ((onshore_rate > (0)::numeric))
);


--
-- Name: blended_rates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.blended_rates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: blended_rates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.blended_rates_id_seq OWNED BY public.blended_rates.id;


--
-- Name: change_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.change_log (
    id bigint NOT NULL,
    entity_type character varying(64) NOT NULL,
    entity_id bigint NOT NULL,
    action character varying(32) NOT NULL,
    field_name character varying(128),
    old_value text,
    new_value text,
    changed_by bigint NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    source character varying(32) DEFAULT 'WEB'::character varying NOT NULL,
    notes text
);


--
-- Name: change_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.change_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: change_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.change_log_id_seq OWNED BY public.change_log.id;


--
-- Name: critical_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.critical_questions (
    id bigint NOT NULL,
    product_id bigint,
    sub_feature_id bigint,
    question_text text NOT NULL,
    help_text text,
    required boolean DEFAULT false NOT NULL,
    display_order integer NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by bigint NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by bigint NOT NULL,
    CONSTRAINT critical_questions_parent_xor_chk CHECK (((product_id IS NOT NULL) <> (sub_feature_id IS NOT NULL)))
);


--
-- Name: critical_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.critical_questions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: critical_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.critical_questions_id_seq OWNED BY public.critical_questions.id;


--
-- Name: estimate_request_phase_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estimate_request_phase_lines (
    id bigint NOT NULL,
    estimate_request_id bigint NOT NULL,
    sdlc_phase_id bigint NOT NULL,
    sdlc_phase_name_snapshot character varying(255) NOT NULL,
    sdlc_phase_display_order_snapshot integer NOT NULL,
    onshore_low numeric(10,2) NOT NULL,
    onshore_med numeric(10,2) NOT NULL,
    onshore_high numeric(10,2) NOT NULL,
    offshore_low numeric(10,2) NOT NULL,
    offshore_med numeric(10,2) NOT NULL,
    offshore_high numeric(10,2) NOT NULL,
    onshore_override numeric(10,2),
    offshore_override numeric(10,2)
);


--
-- Name: estimate_request_phase_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.estimate_request_phase_lines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: estimate_request_phase_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.estimate_request_phase_lines_id_seq OWNED BY public.estimate_request_phase_lines.id;


--
-- Name: estimate_request_question_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estimate_request_question_answers (
    id bigint NOT NULL,
    estimate_request_id bigint NOT NULL,
    critical_question_id bigint NOT NULL,
    question_text_snapshot text NOT NULL,
    answer_text text NOT NULL
);


--
-- Name: estimate_request_question_answers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.estimate_request_question_answers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: estimate_request_question_answers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.estimate_request_question_answers_id_seq OWNED BY public.estimate_request_question_answers.id;


--
-- Name: estimate_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estimate_requests (
    id bigint NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    product_id bigint NOT NULL,
    sub_feature_id bigint,
    template_id bigint,
    complexity character varying(8),
    status character varying(16) DEFAULT 'DRAFT'::character varying NOT NULL,
    requester_id bigint NOT NULL,
    reviewer_id bigint,
    justification text,
    submitted_at timestamp with time zone,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_blended_rate_id bigint,
    CONSTRAINT estimate_requests_complexity_chk CHECK (((complexity IS NULL) OR ((complexity)::text = ANY ((ARRAY['LOW'::character varying, 'MED'::character varying, 'HIGH'::character varying])::text[])))),
    CONSTRAINT estimate_requests_status_chk CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'SUBMITTED'::character varying, 'IN_REVIEW'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[])))
);


--
-- Name: estimate_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.estimate_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: estimate_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.estimate_requests_id_seq OWNED BY public.estimate_requests.id;


--
-- Name: estimate_template_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estimate_template_lines (
    id bigint NOT NULL,
    template_id bigint NOT NULL,
    sdlc_phase_id bigint NOT NULL,
    onshore_low numeric(10,2) NOT NULL,
    onshore_med numeric(10,2) NOT NULL,
    onshore_high numeric(10,2) NOT NULL,
    offshore_low numeric(10,2) NOT NULL,
    offshore_med numeric(10,2) NOT NULL,
    offshore_high numeric(10,2) NOT NULL
);


--
-- Name: estimate_template_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.estimate_template_lines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: estimate_template_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.estimate_template_lines_id_seq OWNED BY public.estimate_template_lines.id;


--
-- Name: estimate_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estimate_templates (
    id bigint NOT NULL,
    product_id bigint,
    sub_feature_id bigint,
    version_number integer NOT NULL,
    is_active boolean NOT NULL,
    change_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by bigint NOT NULL,
    CONSTRAINT estimate_templates_parent_xor_chk CHECK (((product_id IS NOT NULL) <> (sub_feature_id IS NOT NULL)))
);


--
-- Name: estimate_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.estimate_templates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: estimate_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.estimate_templates_id_seq OWNED BY public.estimate_templates.id;


--
-- Name: flyway_schema_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flyway_schema_history (
    installed_rank integer NOT NULL,
    version character varying(50),
    description character varying(200) NOT NULL,
    type character varying(20) NOT NULL,
    script character varying(1000) NOT NULL,
    checksum integer,
    installed_by character varying(100) NOT NULL,
    installed_on timestamp without time zone DEFAULT now() NOT NULL,
    execution_time integer NOT NULL,
    success boolean NOT NULL
);


--
-- Name: invitation_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitation_tokens (
    id bigint NOT NULL,
    token character varying(64) NOT NULL,
    user_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    revoked_at timestamp with time zone
);


--
-- Name: invitation_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invitation_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invitation_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invitation_tokens_id_seq OWNED BY public.invitation_tokens.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    mode character varying(16) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by bigint NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by bigint NOT NULL,
    team_id bigint,
    CONSTRAINT products_mode_chk CHECK (((mode)::text = ANY ((ARRAY['ATOMIC'::character varying, 'CONTAINER'::character varying])::text[])))
);


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.products_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id smallint NOT NULL,
    name character varying(64) NOT NULL
);


--
-- Name: sdlc_phases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sdlc_phases (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    display_order integer NOT NULL,
    active boolean DEFAULT true NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by bigint NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by bigint NOT NULL
);


--
-- Name: sdlc_phases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sdlc_phases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sdlc_phases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sdlc_phases_id_seq OWNED BY public.sdlc_phases.id;


--
-- Name: sub_features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sub_features (
    id bigint NOT NULL,
    product_id bigint NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by bigint NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by bigint NOT NULL
);


--
-- Name: sub_features_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sub_features_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sub_features_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sub_features_id_seq OWNED BY public.sub_features.id;


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by bigint NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by bigint NOT NULL
);


--
-- Name: teams_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.teams_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.teams_id_seq OWNED BY public.teams.id;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id bigint NOT NULL,
    role_id smallint NOT NULL
);


--
-- Name: user_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_teams (
    user_id bigint NOT NULL,
    team_id bigint NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(100) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    invitation_status character varying(32) DEFAULT 'ACTIVE'::character varying NOT NULL,
    invited_by bigint,
    invited_at timestamp with time zone,
    invitation_expires_at timestamp with time zone,
    invitation_accepted_at timestamp with time zone,
    last_active_at timestamp with time zone,
    CONSTRAINT users_invitation_status_check CHECK (((invitation_status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'PENDING_INVITE'::character varying, 'INACTIVE'::character varying])::text[])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: blended_rates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blended_rates ALTER COLUMN id SET DEFAULT nextval('public.blended_rates_id_seq'::regclass);


--
-- Name: change_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_log ALTER COLUMN id SET DEFAULT nextval('public.change_log_id_seq'::regclass);


--
-- Name: critical_questions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.critical_questions ALTER COLUMN id SET DEFAULT nextval('public.critical_questions_id_seq'::regclass);


--
-- Name: estimate_request_phase_lines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_request_phase_lines ALTER COLUMN id SET DEFAULT nextval('public.estimate_request_phase_lines_id_seq'::regclass);


--
-- Name: estimate_request_question_answers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_request_question_answers ALTER COLUMN id SET DEFAULT nextval('public.estimate_request_question_answers_id_seq'::regclass);


--
-- Name: estimate_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_requests ALTER COLUMN id SET DEFAULT nextval('public.estimate_requests_id_seq'::regclass);


--
-- Name: estimate_template_lines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_template_lines ALTER COLUMN id SET DEFAULT nextval('public.estimate_template_lines_id_seq'::regclass);


--
-- Name: estimate_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_templates ALTER COLUMN id SET DEFAULT nextval('public.estimate_templates_id_seq'::regclass);


--
-- Name: invitation_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation_tokens ALTER COLUMN id SET DEFAULT nextval('public.invitation_tokens_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: sdlc_phases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sdlc_phases ALTER COLUMN id SET DEFAULT nextval('public.sdlc_phases_id_seq'::regclass);


--
-- Name: sub_features id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_features ALTER COLUMN id SET DEFAULT nextval('public.sub_features_id_seq'::regclass);


--
-- Name: teams id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams ALTER COLUMN id SET DEFAULT nextval('public.teams_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: blended_rates blended_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blended_rates
    ADD CONSTRAINT blended_rates_pkey PRIMARY KEY (id);


--
-- Name: change_log change_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_log
    ADD CONSTRAINT change_log_pkey PRIMARY KEY (id);


--
-- Name: critical_questions critical_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.critical_questions
    ADD CONSTRAINT critical_questions_pkey PRIMARY KEY (id);


--
-- Name: estimate_request_phase_lines estimate_request_phase_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_request_phase_lines
    ADD CONSTRAINT estimate_request_phase_lines_pkey PRIMARY KEY (id);


--
-- Name: estimate_request_phase_lines estimate_request_phase_lines_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_request_phase_lines
    ADD CONSTRAINT estimate_request_phase_lines_unique UNIQUE (estimate_request_id, sdlc_phase_id);


--
-- Name: estimate_request_question_answers estimate_request_question_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_request_question_answers
    ADD CONSTRAINT estimate_request_question_answers_pkey PRIMARY KEY (id);


--
-- Name: estimate_request_question_answers estimate_request_question_answers_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_request_question_answers
    ADD CONSTRAINT estimate_request_question_answers_unique UNIQUE (estimate_request_id, critical_question_id);


--
-- Name: estimate_requests estimate_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_requests
    ADD CONSTRAINT estimate_requests_pkey PRIMARY KEY (id);


--
-- Name: estimate_template_lines estimate_template_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_template_lines
    ADD CONSTRAINT estimate_template_lines_pkey PRIMARY KEY (id);


--
-- Name: estimate_template_lines estimate_template_lines_unique_phase_per_template; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_template_lines
    ADD CONSTRAINT estimate_template_lines_unique_phase_per_template UNIQUE (template_id, sdlc_phase_id);


--
-- Name: estimate_templates estimate_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_templates
    ADD CONSTRAINT estimate_templates_pkey PRIMARY KEY (id);


--
-- Name: flyway_schema_history flyway_schema_history_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flyway_schema_history
    ADD CONSTRAINT flyway_schema_history_pk PRIMARY KEY (installed_rank);


--
-- Name: invitation_tokens invitation_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation_tokens
    ADD CONSTRAINT invitation_tokens_pkey PRIMARY KEY (id);


--
-- Name: invitation_tokens invitation_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation_tokens
    ADD CONSTRAINT invitation_tokens_token_key UNIQUE (token);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sdlc_phases sdlc_phases_display_order_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sdlc_phases
    ADD CONSTRAINT sdlc_phases_display_order_uq UNIQUE (display_order) DEFERRABLE;


--
-- Name: sdlc_phases sdlc_phases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sdlc_phases
    ADD CONSTRAINT sdlc_phases_pkey PRIMARY KEY (id);


--
-- Name: sub_features sub_features_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_features
    ADD CONSTRAINT sub_features_pkey PRIMARY KEY (id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: user_teams user_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_teams
    ADD CONSTRAINT user_teams_pkey PRIMARY KEY (user_id, team_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: blended_rates_effective_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX blended_rates_effective_date_idx ON public.blended_rates USING btree (effective_date DESC, created_at DESC);


--
-- Name: change_log_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX change_log_actor_idx ON public.change_log USING btree (changed_by, changed_at DESC);


--
-- Name: change_log_changed_at_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX change_log_changed_at_action_idx ON public.change_log USING btree (changed_at DESC, action);


--
-- Name: change_log_changed_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX change_log_changed_at_idx ON public.change_log USING btree (changed_at DESC);


--
-- Name: change_log_changed_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX change_log_changed_by_idx ON public.change_log USING btree (changed_by);


--
-- Name: change_log_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX change_log_entity_idx ON public.change_log USING btree (entity_type, entity_id, changed_at DESC);


--
-- Name: critical_questions_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX critical_questions_created_by_idx ON public.critical_questions USING btree (created_by);


--
-- Name: critical_questions_product_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX critical_questions_product_order_idx ON public.critical_questions USING btree (product_id, display_order) WHERE (product_id IS NOT NULL);


--
-- Name: critical_questions_sub_feature_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX critical_questions_sub_feature_order_idx ON public.critical_questions USING btree (sub_feature_id, display_order) WHERE (sub_feature_id IS NOT NULL);


--
-- Name: critical_questions_updated_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX critical_questions_updated_by_idx ON public.critical_questions USING btree (updated_by);


--
-- Name: estimate_request_phase_lines_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX estimate_request_phase_lines_request_idx ON public.estimate_request_phase_lines USING btree (estimate_request_id);


--
-- Name: estimate_request_question_answers_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX estimate_request_question_answers_request_idx ON public.estimate_request_question_answers USING btree (estimate_request_id);


--
-- Name: estimate_requests_approved_rate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX estimate_requests_approved_rate_idx ON public.estimate_requests USING btree (approved_blended_rate_id) WHERE (approved_blended_rate_id IS NOT NULL);


--
-- Name: estimate_requests_requester_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX estimate_requests_requester_status_idx ON public.estimate_requests USING btree (requester_id, status);


--
-- Name: estimate_requests_reviewer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX estimate_requests_reviewer_idx ON public.estimate_requests USING btree (reviewer_id);


--
-- Name: estimate_requests_status_submitted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX estimate_requests_status_submitted_idx ON public.estimate_requests USING btree (status, submitted_at DESC);


--
-- Name: estimate_templates_active_per_product_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX estimate_templates_active_per_product_uq ON public.estimate_templates USING btree (product_id) WHERE ((is_active = true) AND (product_id IS NOT NULL));


--
-- Name: estimate_templates_active_per_sub_feature_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX estimate_templates_active_per_sub_feature_uq ON public.estimate_templates USING btree (sub_feature_id) WHERE ((is_active = true) AND (sub_feature_id IS NOT NULL));


--
-- Name: estimate_templates_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX estimate_templates_created_by_idx ON public.estimate_templates USING btree (created_by);


--
-- Name: flyway_schema_history_s_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flyway_schema_history_s_idx ON public.flyway_schema_history USING btree (success);


--
-- Name: idx_products_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_team_id ON public.products USING btree (team_id);


--
-- Name: idx_user_teams_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_teams_team_id ON public.user_teams USING btree (team_id);


--
-- Name: invitation_tokens_active_per_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invitation_tokens_active_per_user_idx ON public.invitation_tokens USING btree (user_id, used_at, revoked_at);


--
-- Name: products_active_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_active_name_idx ON public.products USING btree (active, name);


--
-- Name: products_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_created_by_idx ON public.products USING btree (created_by);


--
-- Name: products_name_lower_active_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX products_name_lower_active_uq ON public.products USING btree (lower((name)::text)) WHERE (active = true);


--
-- Name: products_updated_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_updated_by_idx ON public.products USING btree (updated_by);


--
-- Name: sdlc_phases_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sdlc_phases_active_idx ON public.sdlc_phases USING btree (active);


--
-- Name: sdlc_phases_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sdlc_phases_created_by_idx ON public.sdlc_phases USING btree (created_by);


--
-- Name: sdlc_phases_display_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sdlc_phases_display_order_idx ON public.sdlc_phases USING btree (display_order);


--
-- Name: sdlc_phases_name_lower_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sdlc_phases_name_lower_uq ON public.sdlc_phases USING btree (lower((name)::text));


--
-- Name: sdlc_phases_updated_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sdlc_phases_updated_by_idx ON public.sdlc_phases USING btree (updated_by);


--
-- Name: sub_features_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sub_features_created_by_idx ON public.sub_features USING btree (created_by);


--
-- Name: sub_features_product_active_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sub_features_product_active_name_idx ON public.sub_features USING btree (product_id, active, name);


--
-- Name: sub_features_product_name_lower_active_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sub_features_product_name_lower_active_uq ON public.sub_features USING btree (product_id, lower((name)::text)) WHERE (active = true);


--
-- Name: sub_features_updated_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sub_features_updated_by_idx ON public.sub_features USING btree (updated_by);


--
-- Name: teams_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX teams_active_idx ON public.teams USING btree (active);


--
-- Name: teams_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX teams_created_by_idx ON public.teams USING btree (created_by);


--
-- Name: teams_name_lower_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX teams_name_lower_uq ON public.teams USING btree (lower((name)::text));


--
-- Name: teams_updated_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX teams_updated_by_idx ON public.teams USING btree (updated_by);


--
-- Name: user_roles_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_roles_role_idx ON public.user_roles USING btree (role_id);


--
-- Name: users_email_lower_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_lower_uq ON public.users USING btree (lower((email)::text));


--
-- Name: users_invitation_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_invitation_status_idx ON public.users USING btree (invitation_status);


--
-- Name: critical_questions critical_questions_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER critical_questions_set_updated_at BEFORE UPDATE ON public.critical_questions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: estimate_requests estimate_requests_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER estimate_requests_set_updated_at BEFORE UPDATE ON public.estimate_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: products products_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sdlc_phases sdlc_phases_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sdlc_phases_set_updated_at BEFORE UPDATE ON public.sdlc_phases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sub_features sub_features_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sub_features_set_updated_at BEFORE UPDATE ON public.sub_features FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: teams teams_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER teams_set_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: users users_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: blended_rates blended_rates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blended_rates
    ADD CONSTRAINT blended_rates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: critical_questions critical_questions_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.critical_questions
    ADD CONSTRAINT critical_questions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: critical_questions critical_questions_sub_feature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.critical_questions
    ADD CONSTRAINT critical_questions_sub_feature_id_fkey FOREIGN KEY (sub_feature_id) REFERENCES public.sub_features(id) ON DELETE CASCADE;


--
-- Name: estimate_request_phase_lines estimate_request_phase_lines_estimate_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_request_phase_lines
    ADD CONSTRAINT estimate_request_phase_lines_estimate_request_id_fkey FOREIGN KEY (estimate_request_id) REFERENCES public.estimate_requests(id) ON DELETE CASCADE;


--
-- Name: estimate_request_phase_lines estimate_request_phase_lines_sdlc_phase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_request_phase_lines
    ADD CONSTRAINT estimate_request_phase_lines_sdlc_phase_id_fkey FOREIGN KEY (sdlc_phase_id) REFERENCES public.sdlc_phases(id) ON DELETE RESTRICT;


--
-- Name: estimate_request_question_answers estimate_request_question_answers_critical_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_request_question_answers
    ADD CONSTRAINT estimate_request_question_answers_critical_question_id_fkey FOREIGN KEY (critical_question_id) REFERENCES public.critical_questions(id) ON DELETE RESTRICT;


--
-- Name: estimate_request_question_answers estimate_request_question_answers_estimate_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_request_question_answers
    ADD CONSTRAINT estimate_request_question_answers_estimate_request_id_fkey FOREIGN KEY (estimate_request_id) REFERENCES public.estimate_requests(id) ON DELETE CASCADE;


--
-- Name: estimate_requests estimate_requests_approved_blended_rate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_requests
    ADD CONSTRAINT estimate_requests_approved_blended_rate_id_fkey FOREIGN KEY (approved_blended_rate_id) REFERENCES public.blended_rates(id) ON DELETE RESTRICT;


--
-- Name: estimate_requests estimate_requests_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_requests
    ADD CONSTRAINT estimate_requests_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: estimate_requests estimate_requests_sub_feature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_requests
    ADD CONSTRAINT estimate_requests_sub_feature_id_fkey FOREIGN KEY (sub_feature_id) REFERENCES public.sub_features(id) ON DELETE RESTRICT;


--
-- Name: estimate_requests estimate_requests_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_requests
    ADD CONSTRAINT estimate_requests_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.estimate_templates(id) ON DELETE RESTRICT;


--
-- Name: estimate_template_lines estimate_template_lines_sdlc_phase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_template_lines
    ADD CONSTRAINT estimate_template_lines_sdlc_phase_id_fkey FOREIGN KEY (sdlc_phase_id) REFERENCES public.sdlc_phases(id) ON DELETE RESTRICT;


--
-- Name: estimate_template_lines estimate_template_lines_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_template_lines
    ADD CONSTRAINT estimate_template_lines_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.estimate_templates(id) ON DELETE CASCADE;


--
-- Name: estimate_templates estimate_templates_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_templates
    ADD CONSTRAINT estimate_templates_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: estimate_templates estimate_templates_sub_feature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_templates
    ADD CONSTRAINT estimate_templates_sub_feature_id_fkey FOREIGN KEY (sub_feature_id) REFERENCES public.sub_features(id) ON DELETE CASCADE;


--
-- Name: invitation_tokens invitation_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation_tokens
    ADD CONSTRAINT invitation_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: products products_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE RESTRICT;


--
-- Name: sub_features sub_features_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_features
    ADD CONSTRAINT sub_features_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_teams user_teams_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_teams
    ADD CONSTRAINT user_teams_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: user_teams user_teams_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_teams
    ADD CONSTRAINT user_teams_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict QWCjykknvwjXMZ6DJW4M04SQiNJahrB3XmJ6YI8WPzO0mCmymRYWpa8OSHsPbMh

