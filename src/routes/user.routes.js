import { Router } from 'express';
import { changePassword, loginUser, logoutUser, refreshAccessToken, registerUser, updateAvatar, updateCoverImage, updateUserDetails } from '../controllers/user.controller.js';
import {upload} from '../middlewares/multer.middleware.js';
import {verifyJWT} from '../middlewares/auth.middleware.js';
import React from 'react';

const userRouter = Router();

userRouter.route('/register').post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser);

userRouter.route('/login').post(loginUser);

userRouter.route('/changePassword').patch(verifyJWT, changePassword);

userRouter.route('/updateDetails').patch(verifyJWT, updateUserDetails);

userRouter.route('/changeAvatar').patch(verifyJWT, upload.single("avatar"), updateAvatar);

userRouter.route('/changeCoverImage').patch(verifyJWT, upload.single("overImage"), updateCoverImage);



// Secure routes.
userRouter.route('/logout').post(verifyJWT, logoutUser);
userRouter.route('/refresh-token').post(refreshAccessToken)

export default userRouter;