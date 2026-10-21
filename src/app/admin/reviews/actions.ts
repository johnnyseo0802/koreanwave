"use server";
import { moderateMember } from "@/lib/member-moderation";
export async function moderateReview(id:unknown,decision:unknown,revision:unknown){
  return moderateMember("review",id,decision,revision);
}
