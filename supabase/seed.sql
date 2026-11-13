-- Seed reference data (run after migrations). Sample schools match src/data/schools.json.
insert into public.schools (id, name, district) values
  ('shapla-model', 'শাপলা মডেল স্কুল', 'ঢাকা'),
  ('karnaphuli-girls', 'কর্ণফুলী বালিকা বিদ্যালয়', 'চট্টগ্রাম'),
  ('surma-high', 'সুরমা তীর উচ্চ বিদ্যালয়', 'সিলেট'),
  ('padma-par', 'পদ্মাপাড় হাই স্কুল', 'রাজশাহী'),
  ('haor-bidyaniketan', 'হাওর বিদ্যানিকেতন', 'সুনামগঞ্জ'),
  ('rupsha-academy', 'রূপসা একাডেমি', 'খুলনা'),
  ('kirtonkhola-school', 'কীর্তনখোলা স্কুল অ্যান্ড কলেজ', 'বরিশাল'),
  ('teesta-high', 'তিস্তা উচ্চ বিদ্যালয়', 'রংপুর'),
  ('brahmaputra-ideal', 'ব্রহ্মপুত্র আইডিয়াল স্কুল', 'ময়মনসিংহ'),
  ('kushiyara-club', 'কুশিয়ারা বিজ্ঞান ক্লাব', 'মৌলভীবাজার')
on conflict (id) do nothing;

-- Make yourself core team (replace the email), after signing in once:
-- update public.profiles set role = 'core' where id = (select id from auth.users where email = 'you@example.com');
