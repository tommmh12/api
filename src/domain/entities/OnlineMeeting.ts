export interface OnlineMeeting {
    id: string;
    title: string;
    description?: string;
    jitsiRoomName: string;
    creatorId: string;
    scheduledStart: Date;
    scheduledEnd?: Date;
    accessMode: 'public' | 'private';
    status: 'scheduled' | 'active' | 'ended' | 'cancelled';
    jitsiDomain: string;
    recordingUrl?: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}

export interface OnlineMeetingParticipant {
    id: string;
    meetingId: string;
    userId: string;
    invitedAt: Date;
    invitedBy?: string;
    joinedAt?: Date;
    leftAt?: Date;
}

export interface CreateOnlineMeetingDTO {
    title: string;
    description?: string;
    scheduledStart: string;
    scheduledEnd?: string;
    accessMode: 'public' | 'private';
    participantIds?: string[];
}

export interface OnlineMeetingWithDetails extends OnlineMeeting {
    creatorName: string;
    creatorEmail: string;
    creatorAvatar?: string;
    participants: ParticipantDetails[];
}

export interface ParticipantDetails {
    userId: string;
    userName: string;
    email: string;
    avatarUrl?: string;
    departmentName?: string;
    invitedAt: Date;
    joinedAt?: Date;
}
