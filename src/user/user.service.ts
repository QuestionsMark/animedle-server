import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { Animedle as AnimedleNamespace, History as HistoryNamespace, Profile as ProfileNamespace, ServerSuccessfullResponse, User as UserNamespace } from 'src/types';
import { User } from './entities/user.entity';
import { ResponseService } from 'src/common/response/response.service';
import { AuthService } from 'src/auth/auth.service';
import { UseHintDto } from './dto/use-hint.dto';
import { AnimedleService } from 'src/animedle/animedle.service';
import { AnimedleTry } from 'src/animedle/entities/animedle-try.entity';
import { GuesDto } from './dto/gues.dto';
import { Gues } from './entities/gues.entity';
import { ProfileService } from 'src/common/profile/profile.service';
import { ValidationException } from 'src/utils/exceptions.util';
import { FileItem } from 'src/file/entities/file.entity';

@Injectable()
export class UserService {
    constructor(
        @Inject(ResponseService) private responseService: ResponseService,
        @Inject(AuthService) private authService: AuthService,
        @Inject(AnimedleService) private animedleService: AnimedleService,
        @Inject(ProfileService) private profileService: ProfileService,
    ) { }

    async getUserResponse(id: string): Promise<UserNamespace.ContextValue> {
        const { username } = await User.findOneOrFail({
            where: {
                id,
            },
        });

        return {
            id,
            username,
        };
    }

    async create(createUserDto: CreateUserDto): Promise<ServerSuccessfullResponse<string>> {
        const { confirmPassword, email, password, username } = createUserDto;

        // Validation to do


        const newUser = new User();
        newUser.avatar = null;
        newUser.passwordHash = await this.authService.hashPassword(password);
        newUser.email = email;
        newUser.username = username;
        await newUser.save();
        newUser.skins = [];
        const user = await newUser.save();

        await this.profileService.generateAvatar(user);

        return this.responseService.sendSuccessfullResponse('Successfully created an account!');
    }

    async useHint(user: User, useHintDto: UseHintDto): Promise<ServerSuccessfullResponse<AnimedleNamespace.ContextValue>> {
        const { hint } = useHintDto;

        const animedle = await this.animedleService.getActual();

        const anime = await this.animedleService.getAnime(animedle.animeId);
        if (!anime) throw new BadRequestException('Anime not found!');
        const formattedAnimeData = this.animedleService.getFormattedAnimeData(anime);
        const { averageScore, episodes, format, genres, popularity, familiarAnime, season, year, studio } = formattedAnimeData;

        const animedleTry = await AnimedleTry.findOneOrFail({
            where: {
                user: {
                    id: user.id,
                },
                animedle: {
                    id: animedle.id,
                },
            },
        });

        switch (hint) {
            case AnimedleNamespace.HintType.AverageScore: {
                animedleTry.hintType = AnimedleNamespace.HintType.AverageScore;
                animedleTry.hint = averageScore / 10 + '/10';
                await animedleTry.save();
                break;
            }

            case AnimedleNamespace.HintType.Episodes: {
                animedleTry.hintType = AnimedleNamespace.HintType.Episodes;
                animedleTry.hint = String(episodes);
                await animedleTry.save();
                break;
            }

            case AnimedleNamespace.HintType.FamiliarAnime: {
                animedleTry.hintType = AnimedleNamespace.HintType.FamiliarAnime;
                animedleTry.hint = String(familiarAnime);
                await animedleTry.save();
                break;
            }

            case AnimedleNamespace.HintType.Format: {
                animedleTry.hintType = AnimedleNamespace.HintType.Format;
                animedleTry.hint = format;
                await animedleTry.save();
                break;
            }

            case AnimedleNamespace.HintType.Genre: {
                animedleTry.hintType = AnimedleNamespace.HintType.Genre;
                const genresCopy = [...genres];
                const drawedGenres: string[] = [];
                for (let i = 0; i < 2; i++) {
                    const index = Math.floor(Math.random() * genresCopy.length);
                    drawedGenres.push(genresCopy[index]);
                    genresCopy.splice(index, 1);
                }
                animedleTry.hint = drawedGenres.join(', ');
                await animedleTry.save();
                break;
            }

            case AnimedleNamespace.HintType.Popularity: {
                animedleTry.hintType = AnimedleNamespace.HintType.Popularity;
                animedleTry.hint = Intl.NumberFormat('en', { maximumSignificantDigits: 2 }).format(popularity);
                await animedleTry.save();
                break;
            }

            case AnimedleNamespace.HintType.Season: {
                animedleTry.hintType = AnimedleNamespace.HintType.Season;
                animedleTry.hint = season;
                await animedleTry.save();
                break;
            }

            case AnimedleNamespace.HintType.Studio: {
                animedleTry.hintType = AnimedleNamespace.HintType.Studio;
                animedleTry.hint = studio;
                await animedleTry.save();
                break;
            }

            case AnimedleNamespace.HintType.Year: {
                animedleTry.hintType = AnimedleNamespace.HintType.Year;
                animedleTry.hint = String(year);
                await animedleTry.save();
                break;
            }
        }

        return this.responseService.sendSuccessfullResponse(await this.animedleService.getContextValue(user));
    }

    async gues(user: User, guesDto: GuesDto): Promise<ServerSuccessfullResponse<AnimedleNamespace.ContextValue>> {
        const animedle = await this.animedleService.getActual();

        const animedleTry = await AnimedleTry.findOne({
            relations: ['gueses'],
            where: {
                user: {
                    id: user.id,
                },
                animedle: {
                    id: animedle.id,
                },
            }
        });
        if (!animedleTry) throw new ValidationException('Time is over!. New animedle just started!');
        if (animedleTry.isFinished || animedleTry.gueses.length >= 10) throw new ValidationException('Your animedle attempt is over');

        if (animedleTry.gueses.length === 0) {
            if (user.bestStreak < user.streak + 1) {
                user.bestStreak = user.streak + 1;
            }
            user.streak++;
            await user.save();
        }

        const animeId = await this.animedleService.isAnimeTitleCorrect(guesDto.title);
        if (animeId === null) throw new ValidationException('Your anime title is incorrect. Choose one of proposed.');

        const anime = await this.animedleService.getAnime(animeId);
        if (!anime) throw new ValidationException('Anime not found!');

        const actualAnime = await this.animedleService.getAnime(animedle.animeId);
        if (!anime) throw new ValidationException('Anime not found!');

        const { id, title } = anime.data.Media;

        const duplicatedAnime = animedleTry.gueses.find(g => g.animeId === id)
        if (duplicatedAnime) throw new ValidationException("You've already mentioned this anime before");

        const answears = this.animedleService.getAnswears(anime, actualAnime);
        const isCorrect = animedle.animeId === id;

        if (isCorrect) {
            if (user.bestWinStreak < user.winStreak + 1) {
                user.bestWinStreak = user.winStreak + 1;
            }
            user.winStreak++;
            user.points++;
            user.premiumCoins++;
            await user.save();
        } else {
            if (animedleTry.gueses.length === 9) {
                user.winStreak = 0;
                await user.save();
            }
        }

        const gues = new Gues();
        gues.answearsJSON = JSON.stringify(answears);
        gues.isCorrect = isCorrect;
        gues.title = title.romaji;
        gues.animeId = id;
        await gues.save();

        if (isCorrect || animedleTry.gueses.length === 9) {
            animedleTry.isFinished = true;
            await animedleTry.save();
        }

        gues.animedleTry = animedleTry;
        await gues.save();

        return this.responseService.sendSuccessfullResponse(await this.animedleService.getContextValue(user));
    }

    async getHistory(user: User): Promise<ServerSuccessfullResponse<HistoryNamespace.ContextValue>> {
        const animedle = await this.animedleService.getActual();

        const [animedleTries, count] = await AnimedleTry.findAndCount({
            relations: ['user', 'gueses', 'animedle'],
            where: {
                user: {
                    id: user.id,
                },
                isFinished: true,
            },
            order: {
                createdAt: 'DESC',
            },
            take: 20,
        });

        return this.responseService.sendSuccessfullResponse({
            animedles: animedleTries
                .filter(({ animedle: a }) => a.id !== animedle.id)
                .map(({ animedle, gueses, id, hintType }) => ({
                    id,
                    solved: !!gueses.find(g => g.isCorrect),
                    title: animedle.anime,
                    trials: gueses.length,
                    withHint: hintType,
                })),
        }, count);
    }

    async getProfile(user: User): Promise<ServerSuccessfullResponse<ProfileNamespace.ContextValue>> {
        return this.responseService.sendSuccessfullResponse(await this.profileService.getContextValue(user))
    }

    async changeAvatar(user: User, skinId: string): Promise<ServerSuccessfullResponse<ProfileNamespace.ContextValue>> {
        const file = await FileItem.findOneOrFail({
            where: {
                id: skinId,
            },
        });

        user.avatar = file;
        await user.save();

        return this.responseService.sendSuccessfullResponse(await this.profileService.getContextValue(user));
    }

    async createAvatar(user: User): Promise<ServerSuccessfullResponse<ProfileNamespace.ContextValue>> {
        if (user.premiumCoins < 10) throw new ValidationException("You don't have enough premium coins to generate new skin.");
        user.premiumCoins = user.premiumCoins - 10;
        await user.save();
        await this.profileService.generateAvatar(user);

        return this.responseService.sendSuccessfullResponse(await this.profileService.getContextValue(user));
    }

}
