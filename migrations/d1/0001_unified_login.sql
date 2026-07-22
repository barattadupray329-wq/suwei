ALTER TABLE user ADD COLUMN username TEXT;
ALTER TABLE user ADD COLUMN displayUsername TEXT;
ALTER TABLE user ADD COLUMN phoneNumber TEXT;
ALTER TABLE user ADD COLUMN phoneNumberVerified INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX user_username_unique ON user(username);
CREATE UNIQUE INDEX user_phone_number_unique ON user(phoneNumber);

UPDATE user SET username = lower(email), displayUsername = email WHERE username IS NULL;
UPDATE user
SET phoneNumber = (
  SELECT account_profiles.phone
  FROM account_profiles
  WHERE account_profiles.userId = user.id
    AND account_profiles.active = 1
    AND account_profiles.phone IS NOT NULL
), phoneNumberVerified = CASE WHEN EXISTS (
  SELECT 1 FROM account_profiles
  WHERE account_profiles.userId = user.id
    AND account_profiles.active = 1
    AND account_profiles.phone IS NOT NULL
) THEN 1 ELSE 0 END;
