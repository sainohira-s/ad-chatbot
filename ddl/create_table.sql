DROP TABLE review_account_channel_status;
DROP TABLE review_channel_status;
DROP TABLE channel_status;
DROP TABLE account_channel_status;
DROP TABLE channel_composition;
DROP TABLE account;
DROP TABLE channel;
DROP TABLE review_question;
DROP TABLE review_title;
DROP TABLE review_summary_keyword;
DROP TABLE review_summary;
DROP TABLE review_Title_Category;
DROP TABLE keyword;
DROP TABLE message;
DROP TABLE message_type;

-- generate uuidを使用するためにEXTENSION追加
CREATE EXTENSION pgcrypto;

-- メッセージ関連テーブル
CREATE TABLE message_type (
    id     int            PRIMARY KEY,
    name   varchar(20)    NOT NULL
);

CREATE TABLE message (
    id          UUID            PRIMARY KEY,
    message     varchar(500)[]  NOT NULL,
    type_id     int             NOT NULL,
    FOREIGN KEY (type_id) REFERENCES message_type (id)
);

CREATE TABLE keyword (
    id          UUID    PRIMARY KEY,
    message_id  int     NOT NULL,
    keyword     varchar(20)     NOT NULL UNIQUE,
    FOREIGN KEY (message_id)    REFERENCES message (id)
);

-- ステータス関連テーブル
CREATE TABLE channel (
    channel_id      varchar(20)     PRIMARY KEY,
    name            varchar(20)     NOT NULL,
    reviewer_flg    boolean         NOT NULL
);

CREATE TABLE account (
    account_id      varchar(20)     PRIMARY KEY,
    name            varchar(20)     NOT NULL,
    reviewer_flg    boolean         NOT NULL,
    access_count    int             NOT NULL
);

CREATE TABLE channel_composition (
    id              UUID            PRIMARY KEY,
    channel_id      varchar(20)     NOT NULL,
    account_id         varchar(20)  NOT NULL,
    FOREIGN KEY (channel_id) REFERENCES channel (channel_id),
    FOREIGN KEY (account_id) REFERENCES account (account_id)
);

CREATE TABLE channel_status (
    channel_id      varchar(20)     NOT NULL,
    current_type_id int             NOT NULL,
    stage           int             NOT NULL,
    FOREIGN KEY (channel_id) REFERENCES channel (channel_id),
    FOREIGN KEY (current_type_id) REFERENCES message_type (id)
);

CREATE TABLE account_channel_status (
    id              varchar(20) PRIMARY KEY,
    current_type_id int     NOT NULL,
    stage           int     NOT NULL,
    access_count    int     NOT NULL,
    FOREIGN KEY (id) REFERENCES channel_composition (id),
    FOREIGN KEY (current_type_id) REFERENCES message_type (id)
);

-- レビュー関連テーブル

CREATE TABLE review_Title_Category (
    id              serial          PRIMARY KEY,
    category        varchar(20)
);

CREATE TABLE review_summary (
    id              int          PRIMARY KEY,
    summary         varchar(200),
    category_id     int,
    FOREIGN KEY (category_id) REFERENCES review_Title_Category (id)
);

CREATE TABLE review_summary_keyword (
    id              serial          PRIMARY KEY,
    summary_id      int,
    keyword         varchar(20),
    FOREIGN KEY (summary_id) REFERENCES review_summary (id)
);

CREATE TABLE review_title (
    id              serial          PRIMARY KEY,
    title_number    int,
    title           varchar(200),
    category_id     int,
    FOREIGN KEY (category_id) REFERENCES review_Title_Category (id)
);

CREATE TABLE review_question (
    id                  serial          PRIMARY KEY,
    title_id            int,
    question_number     int,
    question            varchar(300),
    FOREIGN KEY (title_id) REFERENCES review_title (id)
);

CREATE TABLE review_channel_status (
    channel_id           varchar(10)     PRIMARY KEY,
    current_summary_id  int,
    current_question    int,
    passing_summary     varchar(200)[],
    passing_question    varchar(800)[],
    FOREIGN KEY (channel_id) REFERENCES channel (channel_id)
);

CREATE TABLE review_account_channel_status (
    id                  varchar(10)     PRIMARY KEY,
    current_summary_id  int,
    current_question    int,
    passing_summary     varchar(200)[],
    passing_question    varchar(800)[],
    FOREIGN KEY (id) REFERENCES channel_composition (id)
);
