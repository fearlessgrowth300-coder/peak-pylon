-- A community member may remove only a message authored by their own account.
-- Administrators retain their existing moderation policy for every post.
create policy "Post authors can delete their own posts"
on public.community_posts
for delete
to authenticated
using ((data ->> 'authorId') = auth.uid()::text);
