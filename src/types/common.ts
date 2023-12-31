export interface MulterFile {
    filename: string;
    size: number;
    mimetype: string;
    originalname: string;
    fieldname: string;
    encoding: string;
}

export interface MulterDiskUploadedFiles {
    [fieldname: string]: MulterFile[] | undefined;
}

export enum CronExpression {
    EveryMidnight = '0 0 * * *',
    Every5Mins = '*/10 * * * *',
}