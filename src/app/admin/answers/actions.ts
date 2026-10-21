"use server";
import { moderateMember } from "@/lib/member-moderation";
export async function moderateAnswer(id:unknown,decision:unknown,revision:unknown){
  return moderateMember("answer",id,decision,revision);
}
