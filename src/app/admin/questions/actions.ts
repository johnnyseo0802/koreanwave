"use server";
import { moderateMember } from "@/lib/member-moderation";
export async function moderateQuestion(id:unknown,decision:unknown,revision:unknown){
  return moderateMember("question",id,decision,revision);
}
