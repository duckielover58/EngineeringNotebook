-- DEV_TEST_ACCOUNTS cleanup
delete from auth.users
where email in (
  'student1@devtest.engilog.local',
  'student2@devtest.engilog.local',
  'student3@devtest.engilog.local',
  'student4@devtest.engilog.local',
  'student5@devtest.engilog.local',
  'teacher1@devtest.engilog.local'
);
