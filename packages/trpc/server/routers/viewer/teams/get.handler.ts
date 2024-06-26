import { markdownToSafeHTML } from "@calcom/lib/markdownToSafeHTML";
import { getTeamWithMembers } from "@calcom/lib/server/queries/teams";
import { MembershipRole } from "@calcom/prisma/enums";

import { TRPCError } from "@trpc/server";

import type { TrpcSessionUser } from "../../../trpc";
import type { TGetInputSchema } from "./get.schema";

type GetOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TGetInputSchema;
};

export const getHandler = async ({ ctx, input }: GetOptions) => {
  const team = await getTeamWithMembers({
    id: input.teamId,
    currentOrg: ctx.user.profile?.organization ?? null,
    userId: ctx.user.organization?.isOrgAdmin ? undefined : ctx.user.id,
    isOrgView: input?.isOrg,
  });

  if (!team) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });
  }

  const membership = team?.members.find((membership) => membership.id === ctx.user.id);

  if (!membership) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Not a member of this team." });
  }
  const { members, ...restTeam } = team;

  // Hide Members of team when 1) Org is private and logged in user is not admin or owner
  // OR
  // 2)Team is private and logged in user is not admin or owner of team or Organization's admin or owner
  const hideMembers =
    (ctx.user.profile?.organization?.isPrivate && !ctx.user.organization?.isOrgAdmin) ||
    (team.isPrivate &&
      !(membership.role === MembershipRole.OWNER || membership.role === MembershipRole.ADMIN) &&
      !ctx.user.organization?.isOrgAdmin);

  return {
    ...restTeam,
    members: hideMembers ? [] : members,
    safeBio: markdownToSafeHTML(team.bio),
    membership: {
      role: membership.role,
      accepted: membership.accepted,
    },
  };
};

export default getHandler;
